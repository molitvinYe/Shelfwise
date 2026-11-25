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
| GET | `/books/subjects` | public | — | `{ items: [{ subject, count }] }`, most common first (filter UI). Not cached in the API (a GROUP BY over a few thousand rows); the web caches it for hours |
| GET | `/books/:id` | public | — | `BookDetail` = book + `{ ratingAverage, ratingCount }`. Unknown **or malformed** id → `404 NOT_FOUND` |
| GET | `/books/:id/reviews` | public | limit, cursor | `Page<ReviewItem>` (non-hidden reviews, newest first) |
| GET | `/books/external-search` | access, throttled | q | Open Library search results (`olKey, title, authors, year, coverId, alreadyImported`) |
| POST | `/books/import` | access, throttled | `{ olKey }` | `201 BookDetail` (or `200` if already present) |

## Business rules
- **Search query builder** (`book-search.query.ts`, pure, unit-tested): one `Prisma.sql` statement with every value bound. With `q`, default sort = relevance, else `title`. `sort=relevance` without `q` → 400 (validated in the shared schema).
- **Relevance** = `ts_rank_cd(searchVector, websearch_to_tsquery('english', q))` + 1 for an exact (case-insensitive) title match, so "dune" puts *Dune* above *Dune Messiah* (same title weight otherwise). Rounded to `numeric(…, 6)`: `ts_rank_cd` is a `float4`, which would not round-trip exactly through a JSON cursor.
- **Keyset:** the sort key is selected as `"sortKey"` in a subquery, the outer query applies `("sortKey", id) < / > (cursor)` and `ORDER BY "sortKey", id` in one direction, `LIMIT limit + 1`. Keys: relevance → rounded rank DESC, title → `title` ASC, year_desc/year_asc → `COALESCE(year, -1)` DESC / `COALESCE(year, 9999)` ASC (books without a year last in both), newest → `createdAt` DESC.
- **Cursor** (`common/pagination/cursor.ts`): base64url JSON `{ s: sort, k: key, id }`; a cursor from another sort or a malformed one → `400 VALIDATION_FAILED`.
- **Subject filter:** `subjects @> ARRAY[$subject]` (GIN). Subjects normalised to lowercase at seed/import.
- **Rating summary:** `AVG(rating), COUNT(rating)` over `UserBook` where `rating IS NOT NULL` (index on `bookId`). Not denormalised — catalog is small; revisit only if it shows up as slow.
- **`myShelf`:** moved to step 10 (shelves). The public book page is cached and shared by all visitors, so the viewer's shelf state will come from a separate authenticated request rather than this response.
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
4. Search query builder + `GET /books` + `GET /books/subjects` (step 8) ✅.
5. `GET /books/:id`, `GET /books/:id/reviews` (step 8; reviews list fills up in step 10) ✅.
6. External search + import (step 9).
