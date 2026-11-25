# auth

> Roadmap: step 6 · Depends on: users, PrismaModule, ConfigModule · Decision: [ADR-0003](../adr/0003-auth-jwt-refresh-rotation.md)

## Purpose
Registration, login, demo login, logout, token refresh with rotation and reuse detection; global JWT guard and role guard.

## Owns (data)
`RefreshToken` (id, userId, familyId, tokenHash, expiresAt, revokedAt, createdAt).

## Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/register` | public, throttled | `RegisterInput` {email, password, displayName} | `201 { user }` + cookies |
| POST | `/auth/login` | public, throttled | `LoginInput` {email, password} | `200 { user }` + cookies |
| POST | `/auth/demo` | public, throttled | — | `200 { user }` + cookies (demo user) |
| POST | `/auth/refresh` | refresh cookie | — | `200 { user }` + rotated cookies |
| POST | `/auth/logout` | refresh cookie (optional) | — | `204`, cookies cleared |
| GET | `/auth/me` | access | — | `200 { user }` |

`user` = `PublicUser` {id, email, displayName, role, isDemo}.

## Business rules
- **Cookies:** `sw_access` (15 min) and `sw_refresh` (7 days), both `Path=/; httpOnly; Secure; SameSite=Lax`. The refresh cookie is not narrowed to `/api/auth`: the Next.js proxy refreshes the session on page requests, so it must see it. In local dev `Secure` is off (`NODE_ENV !== 'production'`).
- **Register:** email normalised (trim + lowercase); `409 EMAIL_TAKEN` on unique violation (catch Prisma `P2002`, don't pre-check — avoids races).
- **Login:** constant error `401 INVALID_CREDENTIALS` for unknown email or wrong password; run argon2 verify against a dummy hash when the user doesn't exist to keep timing similar.
- **Refresh (transaction):**
  1. hash presented token → find row;
  2. not found or expired → 401;
  3. `revokedAt` set:
     - rotated (`rotatedAt`) less than **10 s** ago, the family still has a live token and fewer than **10** grace successors were issued from it (`graceCount`, conditional increment) → a concurrent request with the same cookie (parallel prefetches, two tabs): issue a successor, don't revoke;
     - otherwise **reuse detected** → revoke all tokens of that `familyId`, log a warning, 401;
  4. otherwise set `revokedAt = rotatedAt = now` (conditional on `revokedAt IS NULL`; a lost race goes through step 3), insert new token with same `familyId`, issue new access JWT.
- **Logout:** revoke all tokens in the presented token's family; clear cookies even if no token.
- **Cleanup:** on each login, delete that user's tokens expired > 1 day ago.
- **Demo:** `/auth/demo` finds the user with `isDemo = true` (seeded); 503 if missing.
- **Seed:** `src/seed/seed-users.ts` creates the demo user (`demo@shelfwise.app`, no password) and the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; idempotent, never overwrites a password and never promotes an existing account that owns `ADMIN_EMAIL` (registration is open and unverified — it could be pre-claimed; the seed logs a warning instead); runs on every production start.
- **Guards:** `JwtAuthGuard` registered globally (`APP_GUARD`), reads `sw_access` cookie (fallback: `Authorization: Bearer` for tests / ADR-0002 fallback). `@Public()` skips it. `RolesGuard` + `@Roles(Role.ADMIN)`. `@CurrentUser()` param decorator.
- **Expired access token** → `401` with code `TOKEN_EXPIRED` (lets the client know to refresh rather than log out).

## Validation (shared schemas)
- `RegisterInput`: email (valid, ≤ 254), password (8–128 chars), displayName (2–40, trimmed).
- `LoginInput`: email, password (≤ 128, no other rules — don't leak policy).

## Security
- argon2id with library defaults; never log passwords, tokens or cookies (pino redact).
- Throttle `register` / `login` / `demo`: 10 req/min per IP; register additionally 5/hour per IP (env-configurable). Not `me` / `refresh` / `logout` — the web app calls them server-side from one Vercel IP.
- Client IP comes from `X-Forwarded-For` via Express `trust proxy` = `TRUST_PROXY_HOPS`; verify on production with `GET /health/client-ip` (debug route).
- Global `OriginGuard` for all non-GET requests: an `Origin` header, if present, must be in `ALLOWED_ORIGINS`.
- JWT secret ≥ 32 chars, validated at startup.

## UI
Pages `/login`, `/register`, landing "Log in as demo" button — see [web.md](web.md).

## Tests
- Unit: `TokenService` (hashing, rotation outcome, reuse → family revoke), cookie options per env.
- e2e: register → me; duplicate email 409; login wrong password 401; refresh rotates (old token then fails and kills the family); logout revokes; expired access → `TOKEN_EXPIRED`; `@Roles` blocks USER from an admin route; demo login works.

## Implementation checklist
1. Shared schemas + `PublicUser` type + error codes. ✅
2. Prisma `RefreshToken` model + migration (done in step 3 schema). ✅
3. `PasswordService` (argon2), `TokenService` (JWT sign/verify, refresh generate/hash/rotate). ✅
4. `AuthService` (register/login/demo/refresh/logout) + `AuthController` with cookie helpers. ✅
5. Global `JwtAuthGuard`, `@Public`, `@CurrentUser`, `RolesGuard`, `@Roles`. ✅
6. Throttler config, Origin check. ✅
7. e2e tests. ✅
8. Web: login/register pages, auth state, proxy refresh (see web.md). ✅
