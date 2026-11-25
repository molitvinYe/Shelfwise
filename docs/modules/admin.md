# admin

> Roadmap: step 13 · Depends on: users, shelves · Guard: `@Roles(Role.ADMIN)` on the whole controller

## Purpose
Minimal moderation: hide/unhide reviews, list users and change roles. Proves server-side RBAC.

## Owns (data)
Nothing; operates on `UserBook.isReviewHidden` and `User.role` via the owning modules' services.

## Endpoints (all ADMIN only)

| Method | Path | Params / Body | Response |
|--------|------|---------------|----------|
| GET | `/admin/reviews` | hidden? (bool), q? (book title), limit, cursor | `Page<AdminReviewItem>` (user, book, rating, review, isReviewHidden, updatedAt) |
| PATCH | `/admin/reviews/:userId/:bookId` | `{ isHidden: boolean }` | `AdminReviewItem` |
| GET | `/admin/users` | q? (email/name), limit, cursor | `Page<AdminUserItem>` |
| PATCH | `/admin/users/:id/role` | `{ role: 'USER' \| 'ADMIN' }` | `AdminUserItem` |
| POST | `/admin/demo/reset` | — (auth: `x-cron-secret` = `CRON_SECRET`, **not** a JWT; `@Public()` + secret guard) | `204` — optional, step 17 |

## Business rules
- Role is checked from the JWT by `RolesGuard` **and** re-read from the DB in the admin service before mutating (role downgrade isn't delayed by token TTL for sensitive actions).
- An admin cannot change their own role (400 `CANNOT_CHANGE_OWN_ROLE`) and the last remaining admin can't be demoted (409 `LAST_ADMIN`).
- Demo user's role can't be changed to ADMIN (400).
- First admin is created by the seed from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (only if absent).
- Every admin mutation is logged at `info` with actor id, target and action (simple audit trail in logs; no audit table in MVP).

## Security
- `@Roles('ADMIN')` at controller level; e2e proves USER and anonymous get 403/401.

## UI
`/admin` area (server-side role check in layout + API enforcement): reviews table with hide/unhide toggle and filter; users table with role select — see [web.md](web.md).

## Tests
- e2e: USER → 403 on every admin route; hide review removes it from public `/books/:id/reviews`; last-admin and self-change rules.

## Implementation checklist
1. `AdminController` + `AdminService` delegating to `ShelvesService` / `UsersService`.
2. e2e RBAC tests.
3. Web admin pages.
