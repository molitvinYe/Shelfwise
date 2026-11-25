# collections

> Roadmap: step 12 · Depends on: books, users, PrismaModule

## Purpose
User-curated ordered lists of books, optionally public at `/c/[slug]` with a shareable OG image.

## Owns (data)
`Collection` (id, ownerId, title, description?, slug, isPublic, createdAt, updatedAt), `CollectionBook` (collectionId + bookId PK, position).

## Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/collections/me` | access | limit, cursor | `Page<CollectionSummary>` (with book count + first 4 covers) |
| POST | `/collections` | access | `CreateCollectionInput` {title, description?, isPublic} | `201 CollectionDetail` |
| GET | `/collections/:id` | access (owner) | — | `CollectionDetail` |
| PATCH | `/collections/:id` | owner | `UpdateCollectionInput` | `CollectionDetail` |
| DELETE | `/collections/:id` | owner | — | `204` (cascade `CollectionBook`) |
| POST | `/collections/:id/books` | owner | `{ bookId }` | `CollectionDetail` (appended at end) |
| DELETE | `/collections/:id/books/:bookId` | owner | — | `204` |
| PUT | `/collections/:id/books/order` | owner | `{ bookIds: uuid[] }` | `CollectionDetail` |
| GET | `/collections/by-slug/:slug` | public | — | `PublicCollection` (only if `isPublic`; else 404) |

## Business rules
- **Slug:** `slugify(title)` (max 60 chars) + `-` + 6-char random base36 suffix; generated once on create, **not** changed on rename (shared links stay valid). Retry on unique conflict (max 3).
- **Ownership:** every owner route loads by `{ id, ownerId: currentUser.id }` → 404 if not found (don't reveal existence).
- **Private collection via slug** → 404, same as nonexistent.
- **Max 100 books per collection** (`409 COLLECTION_FULL`); max 50 collections per user.
- **Add book:** position = max + 1; adding a duplicate → 409 `ALREADY_IN_COLLECTION`.
- **Reorder:** body must be a permutation of the current book ids (same set, no duplicates) else 400; in one transaction rewrite positions `0..n-1`. With ≤ 100 rows this is simpler and safer than fractional indexing.
- `updatedAt` bumps on any change (used for "my collections" order and OG cache busting).

## Validation
- title 1–80, description ≤ 500, isPublic boolean; `bookIds` array of uuid, 1–100, unique.

## Security
- Owner checks in the service layer (not only in the UI). Public endpoint returns owner's `displayName` only.

## UI
`/collections` (mine), `/collections/[id]` editor with drag-and-drop + keyboard reorder (`@dnd-kit` — accessible), public `/c/[slug]` (Server Component, `generateMetadata`), `opengraph-image.tsx` with title, owner and up to 4 covers — see [web.md](web.md).

## Tests
- Unit: slug generation; reorder permutation validation.
- e2e: CRUD; non-owner gets 404 on all owner routes; private slug → 404; reorder persists; limits enforced.

## Implementation checklist
1. Shared schemas.
2. `CollectionsService` + controller + e2e.
3. Web: list, editor with reorder (optimistic), public page, OG image.
