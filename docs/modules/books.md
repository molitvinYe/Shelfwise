# books

> Roadmap: steps 7–9 · Depends on: PrismaModule, ConfigModule · Decision: [ADR-0004](../adr/0004-catalog-in-postgres-fts.md)

## Purpose
The catalog: seed data, full-text search with filters/sort/pagination, book details with rating summary and reviews, import from Open Library. Also exposes `BooksService.search()` and `findByIds()` for the AI tools.

## Owns (data)
`Book` (id, olKey, title, authors[], description?, year?, subjects[], language?, coverId?, searchVector, createdAt).

## Endpoints

| Method | Path | Auth | Params / Body | Response |
|--------|------|------|---------------|----------|
| GET | `/books` | public | `BookSearchQuery`: q?, subject?, yearFrom?, yearTo?, language?, sort (`relevance` \| `title` \| `year_desc` \| `year_asc` \| `newest`), limit, cursor | `Page<BookListItem>` |
| GET | `/books/subjects` | public | — | top subjects with counts (for the filter UI; cached in memory 1h) |
| GET | `/books/:id` | public | — | `BookDetail` = book + `{ ratingAverage, ratingCount, myShelf? }` |
| GET | `/books/:id/reviews` | public | limit, cursor | `Page<ReviewItem>` (non-hidden reviews, newest first) |
| GET | `/books/external-search` | access, throttled | q | Open Library search results (`olKey, title, authors, year, coverId, alreadyImported`) |
| POST | `/books/import` | access, throttled | `{ olKey }` | `201 BookDetail` (or `200` if already present) |

## Business rules
- **Search query builder** (pure function, unit-tested): builds SQL fragments from filters. With `q`, default sort = relevance (`ts_rank_cd`), else `title`. `sort=relevance` without `q` → 400.
- **Cursor keys per sort:** relevance → `(rank, id)`, title → `(title, id)`, year → `(year NULLS LAST, id)`, newest → `(createdAt, id)`.
- **Subject filter:** `subjects @> ARRAY[$subject]` (GIN). Subjects normalised to lowercase at seed/import.
- **Rating summary:** `AVG(rating), COUNT(rating)` over `UserBook` where `rating IS NOT NULL` (index on `bookId`). Not denormalised — catalog is small; revisit only if it shows up as slow.
- **`myShelf`:** included when a user is authenticated (optional auth on this route).
- **Seed pipeline:**
  - `pnpm data:fetch` → `apps/api/scripts/fetch-openlibrary.ts` (tsx): for each of the 32 curated categories (`open-library/categories.ts`) fetch the 150 most-read works from `search.json?q=subject:"…"&sort=readinglog&lang=en`, keep only works with title, author, year and cover; dedupe by `olKey`; then `/works/{key}.json` for descriptions (2 workers, ~3 req/s overall). `User-Agent: Shelfwise/0.2 (${OPEN_LIBRARY_CONTACT})`. Writes `apps/api/data/books.snapshot.json` (sorted by `olKey`, stable diffs) — committed.
  - **Mapping** (`open-library.mapper.ts`, shared with import in step 9): title of the best English edition when there is one (`lang=en` → `editions`), else the work title; up to 5 unique authors; `language` = `eng` if any English edition, else the first; description from string or `{ value }`, without Open Library's `----------` source footer and markdown links, ≤ 2000 chars.
  - **Subjects** = the curated categories the book was fetched for (merged across categories). Open Library's own tags are too noisy for popular works; alias matching (`toCategories` without a category) is only for import on demand.
  - `pnpm db:seed` → `src/seed/run-seed.ts`: users (step 6), then books: reads the existing `olKey`s and inserts only missing ones in batches of 500 (`createMany skipDuplicates`). Never updates existing rows, so books imported or edited later are safe. Runs on every production start (docs/modules/infra.md). Step 17 adds demo shelves/collections.
- **Import on demand:** fetch `/works/{olKey}.json` (+ author names), map with the same mapper as the fetch script (shared function), upsert by `olKey`. Upstream failure → `502 UPSTREAM_UNAVAILABLE`. Throttle: 10 imports/hour per user; demo user: 3/hour.
- **Covers:** `coverId` → `https://covers.openlibrary.org/b/id/{coverId}-M.jpg` (L for book page). No cover → placeholder.

## Validation
- `BookSearchQuery`: q ≤ 200 chars; yearFrom/yearTo int 0–2100 and `yearFrom ≤ yearTo`; language ISO 639 code (3 letters as Open Library uses, e.g. `eng`); limit 1–50; cursor opaque string ≤ 500.
- `ImportBookInput`: olKey matches `^/works/OL\d+W$`.

## Security
- All raw SQL through `Prisma.sql` tagged templates with bound parameters.
- External-search / import require auth + throttling to prevent using us as an Open Library proxy.

## UI
Catalog `/books`, book page `/books/[id]`, import dialog — see [web.md](web.md).

## Tests
- Unit: query builder (each filter, sort+cursor combinations), cursor encode/decode, Open Library mapper (missing fields, description as string vs `{ value }` object).
- e2e (seeded fixture of ~20 books): search ranks title match above description match; filters combine; pagination returns no duplicates across pages; import is idempotent (Open Library mocked with `nock` or an injected HTTP client).

## Implementation checklist
1. Prisma `Book` model + raw SQL migration: trigger function, trigger, GIN indexes (step 3).
2. Open Library client (fetch with timeout + retry) and mapper (step 7) ✅.
3. `data:fetch` script → commit snapshot; `db:seed` (step 7) ✅.
4. Search query builder + `GET /books` + `GET /books/subjects` (step 8).
5. `GET /books/:id`, `GET /books/:id/reviews` (step 8; reviews list fills up in step 10).
6. External search + import (step 9).
