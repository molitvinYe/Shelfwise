# 0003. Access JWT + rotating refresh token in httpOnly cookies

- Status: Accepted
- Date: 2026-11-25

## Context
Need stateless request auth (cheap on a sleeping free-tier API), the ability to log out / revoke sessions, and protection against XSS token theft. Server Components must be able to render personalised pages.

## Decision
- **Access token:** JWT (HS256, `JWT_ACCESS_SECRET`), 15 min, claims `sub`, `role`, `isDemo`. Stored in an `httpOnly; Secure; SameSite=Lax; Path=/` cookie `sw_access` — so Server Components and middleware can read it from the request, and JS cannot.
- **Refresh token:** 32 random bytes (base64url), 7 days, cookie `sw_refresh` with `Path=/api/auth`. Only its **SHA-256 hash** is stored (`RefreshToken.tokenHash`) — the token is high-entropy, so a fast hash is sufficient; argon2 is for passwords.
- **Rotation:** every `/auth/refresh` revokes the presented token and issues a new one in the same `familyId`, in one transaction.
- **Reuse detection:** presenting an already-revoked token revokes the entire family (likely theft) and returns 401.
- **Logout:** revokes the current family, clears both cookies.
- **Passwords:** argon2id (`argon2` package, library defaults). Login returns the same error for unknown email and wrong password.
- **CSRF:** `SameSite=Lax` + `Origin` check on mutating requests + JSON-only bodies.
- **Demo login:** `POST /auth/demo` logs in the seeded demo user without a password — no credentials in the frontend bundle.
- **Roles:** `@Roles('ADMIN')` + `RolesGuard`, role read from the JWT; role changes take effect at next refresh (≤ 15 min) — acceptable, documented.

## Alternatives considered
- **Access token in memory (JS), refresh in cookie** — Server Components can't authenticate the first render; every page load needs a client-side refresh round-trip.
- **Server sessions in DB** — a DB hit per request on a free-tier DB that suspends; also less interesting to present.
- **Auth.js / Clerk / Lucia** — hides exactly the auth work the portfolio is meant to show.

## Consequences
- Need cleanup of expired refresh tokens (delete on login for that user + a cheap periodic delete in `health` or a GitHub Actions cron; volume is tiny).
- Role downgrade isn't instant (≤ 15 min). Admin actions re-check role from DB to be safe.
- Middleware must handle silent refresh for SSR (see [modules/web.md](../modules/web.md)).
