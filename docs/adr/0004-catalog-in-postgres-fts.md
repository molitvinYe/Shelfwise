# 0004. Own catalog in Postgres with full-text search; Open Library as import source

- Status: Accepted
- Date: 2026-11-25

## Context
Shelves, reviews, collections and AI tools all need stable book ids, joins and filters. Open Library is free but slow, rate-limited and not something we control.

## Decision
- Books live in our `Book` table; `olKey` (e.g. `/works/OL45883W`) is the unique external id.
- **Seeding:** `scripts/fetch-openlibrary.ts` pulls a few thousand works from popular subjects (Subjects API + per-work details for descriptions), throttled, with a descriptive `User-Agent`, and writes `data/books.snapshot.json` — **committed**. `prisma/seed.ts` reads only the snapshot (deterministic, offline, CI-safe).
- **Search:** `searchVector tsvector` maintained by a trigger:
  `setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', authors joined), 'B') || setweight(to_tsvector('english', coalesce(description,'')), 'C') || setweight(to_tsvector('english', subjects joined), 'D')`.
  One config (`english`) for every field **and** for queries. *Amended at implementation (step 3):* the first draft indexed authors/subjects with `simple`, but a query parsed with `english` is stemmed (`romance` → `romanc`) and then never matches the unstemmed `simple` lexemes — caught by the schema e2e test.
  Query with `websearch_to_tsquery('english', $q)`, rank with `ts_rank_cd`. GIN index.
- Prisma: `searchVector Unsupported("tsvector")?`; trigger, function and index in a raw SQL migration; search via `$queryRaw` with parameter binding (never string concatenation).
- **Import on demand:** authenticated users can search Open Library (proxied, 5s timeout) and import a work by `olKey`; upsert is idempotent on `olKey`.

## Alternatives considered
- **Query Open Library live** — no joins, slow, rate limits, can't guarantee AI recommendations exist.
- **Meilisearch / Typesense / Algolia** — better relevance, but another service to host on a $0 budget; Postgres FTS is good enough and a better interview story about indexing.
- **`pg_trgm` only** — good for fuzzy titles, weak for descriptions. May be added later for typo tolerance on titles (non-MVP).

## Consequences
- The snapshot file is a few MB in git; acceptable.
- Search quality is "good, not Google" — documented in trade-offs.
- Cursor pagination by relevance uses `(rank, id)` keys; rank is deterministic for the same query, so cursors are stable.
