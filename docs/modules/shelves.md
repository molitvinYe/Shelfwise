# shelves

> Roadmap: steps 10–11 · Depends on: books, PrismaModule

## Purpose
A user's relationship with a book: shelf status, rating, review. Also review moderation flags (set by admin) and profile stats.

## Owns (data)
`UserBook` (userId + bookId PK, status, rating?, review?, isReviewHidden, createdAt, updatedAt).

## Endpoints

| Method | Path | Auth | Body / Params | Response |
|--------|------|------|---------------|----------|
| GET | `/shelves/me` | access | status?, limit, cursor | `Page<ShelfItem>` (book + status/rating/review), sorted by `updatedAt desc` |
| GET | `/users/:id/shelves` | public | status?, limit, cursor | same, public view (hidden reviews omitted) |
| PUT | `/shelves/:bookId` | access | `UpsertShelfInput` {status, rating?, review?} | `ShelfItem` |
| PATCH | `/shelves/:bookId` | access | `UpdateShelfInput` (partial) | `ShelfItem` |
| DELETE | `/shelves/:bookId` | access | — | `204` |
| GET | `/shelves/me/stats` | access | — | `ProfileStats` |

## Business rules
- `PUT` is an upsert on `(userId, bookId)` → idempotent, ideal for optimistic UI. `404 BOOK_NOT_FOUND` if the book doesn't exist.
- Rating and review are allowed for **any** status (people rate abandoned books), but the UI only prompts for them on `READ`.
- `review` set to empty string → stored as `null`.
- Editing a review does **not** clear `isReviewHidden`: it stays hidden until an admin unhides it (prevents edit-to-bypass moderation).
- `userId` always comes from the JWT, never from the body or path (authorization by construction).
- Stats: one aggregate query grouped by status + avg rating + count of READ with `updatedAt` in the current year.
- Demo user: same rules; demo data is reset by the optional nightly job (step 17).

## Validation
- `ShelfStatus` enum `WANT | READING | READ` (shared).
- rating int 1–5 or null; review ≤ 5,000 chars, trimmed.
- `bookId` uuid.

## Security
- All mutations scoped by `userId` from token; deleting someone else's row is impossible by query shape.
- Reviews are rendered as plain text (React escapes); no markdown/HTML in MVP.

## UI
`ShelfButton` (status dropdown, optimistic), `RatingStars`, `ReviewForm` on the book page; profile shelves tabs — see [web.md](web.md).

## Tests
- Unit: stats aggregation mapping; upsert input normalisation.
- e2e: upsert creates then updates; user A can't affect user B; hidden review not returned publicly but still visible to its author (with a "hidden by moderator" flag); stats correct for a fixture.

## Implementation checklist
1. Shared schemas (`UpsertShelfInput`, `UpdateShelfInput`, `ShelfItem`, `ProfileStats`).
2. `ShelvesService` (upsert, update, remove, listForUser, stats, `listReviewsForBook` used by books).
3. Controller + e2e.
4. Web: optimistic `ShelfButton`, rating, review form, profile page (step 11).
