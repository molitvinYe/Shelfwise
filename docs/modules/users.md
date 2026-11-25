# users

> Roadmap: steps 6, 11 · Depends on: PrismaModule

## Purpose
User records and public profile data. Used by `auth` (create/find) and `admin` (list, change role).

## Owns (data)
`User` (id, email, passwordHash, displayName, role, isDemo, createdAt).

## Endpoints

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/users/me` | access | `PublicUser` (alias of `/auth/me`, optional) |
| PATCH | `/users/me` | access | `UpdateProfileInput` {displayName} → `PublicUser` |
| GET | `/users/:id/profile` | public | `{ id, displayName, stats }` — stats from shelves module |

Stats (`ProfileStats`): `{ readCount, readingCount, wantCount, averageRating | null, readThisYear }` — computed by `ShelvesService.getStats(userId)`.

## Business rules
- `passwordHash` never leaves the service layer: repository selects use an explicit `select` / a `toPublicUser` mapper.
- Demo user cannot change displayName (403 `DEMO_READONLY`) — keeps the demo tidy.
- Profile is public (shelves are public in this MVP). Email is never exposed publicly.

## Validation
- `UpdateProfileInput`: displayName 2–40 chars, trimmed.
- `:id` param: uuid.

## Tests
- Unit: mapper never returns `passwordHash`.
- e2e: public profile hides email; demo user PATCH → 403.

## Implementation checklist
1. `UsersService`: `create`, `findByEmail`, `findById`, `findDemo`, `toPublicUser` (step 6) ✅.
2. `PATCH /users/me` (step 11).
3. `GET /users/:id/profile` with stats (step 11, after shelves).
