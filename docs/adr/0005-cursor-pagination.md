# 0005. Cursor (keyset) pagination for all lists

- Status: Accepted
- Date: 2026-11-25

## Context
Lists change while users scroll (new reviews, shelf updates), and `OFFSET` gets slower and produces duplicates/skips on changing data.

## Decision
- All list endpoints accept `limit` (default 20, max 50) and an opaque `cursor`; respond `{ items, nextCursor }`.
- Cursor = base64url(JSON) of the last row's sort key(s) plus `id` as the tie-breaker; validated with a Zod schema on decode (malformed → 400).
- Queries use row comparison: `WHERE (sortKey, id) < ($1, $2) ORDER BY sortKey DESC, id DESC LIMIT limit + 1` (the extra row tells whether there is a next page).
- Shared helper in `apps/api/src/common/pagination/` and response schema factory in `packages/shared`.
- UI uses infinite scroll / "Load more" via TanStack Query `useInfiniteQuery` (client) or a `?cursor=` link (server-rendered catalog).

## Alternatives considered
- **Offset pagination** — simpler, but the trade-off is exactly what interviewers ask about.
- **Total counts** — skipped; `COUNT(*)` with FTS is expensive. UI shows "Load more", not page numbers.

## Consequences
- No "jump to page 7". Fine for this product.
- Every sortable column needs a composite index with `id` (see [architecture.md](../architecture.md#data-model)).
