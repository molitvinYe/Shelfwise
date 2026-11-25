# packages/shared (`@shelfwise/shared`)

> Roadmap: created in step 1, grows with every module · Decision: [ADR-0001](../adr/0001-monorepo-and-shared-contracts.md)

## Purpose
Single source of truth for API contracts: Zod schemas, inferred types, enums, error codes and limits shared by web and api.

## Layout

```
packages/shared/src/
├─ index.ts              re-exports
├─ enums.ts              Role, ShelfStatus, BookSort
├─ errors.ts             ErrorCode enum, ApiError schema
├─ limits.ts             MAX_PAGE_SIZE, REVIEW_MAX, COLLECTION_MAX_BOOKS, CHAT_MAX_MESSAGES …
├─ pagination.ts         PageQuery schema, pageOf(itemSchema) factory
└─ schemas/
   ├─ auth.ts            RegisterInput, LoginInput, PublicUser
   ├─ users.ts           UpdateProfileInput, ProfileStats, PublicProfile
   ├─ books.ts           BookSearchQuery, BookListItem, BookDetail, BookCard, ReviewItem, ImportBookInput
   ├─ shelves.ts         UpsertShelfInput, UpdateShelfInput, ShelfItem
   ├─ collections.ts     Create/UpdateCollectionInput, ReorderInput, CollectionSummary/Detail, PublicCollection
   ├─ admin.ts           AdminReviewItem, AdminUserItem, SetRoleInput, SetReviewHiddenInput
   └─ ai.ts              ChatInput, AiUsageResponse, tool input/output schemas
```

## Rules
- Only `zod` as a runtime dependency. No Node or browser-specific code.
- Every schema exports both the schema and its type: `export const LoginInput = z.object(...); export type LoginInput = z.infer<typeof LoginInput>;`
- Input schemas do normalisation (`.trim()`, `.toLowerCase()` for email) so both sides behave identically.
- Query-string schemas use `z.coerce` for numbers/booleans.
- Dates cross the wire as ISO strings (`z.string().datetime()`), not `Date`.
- Breaking a schema = breaking the API: change both apps in the same commit.

## Build
- ESM-only. `tsc -p tsconfig.build.json` → `dist/` (`.js`, `.d.ts`, maps). `package.json` `exports` maps `types` / `default`.
- Source uses `nodenext` resolution, so relative imports end in `.js`.
- `pnpm --filter @shelfwise/shared build` runs before api/web typecheck & build in CI; `dev` runs `tsc --watch` (root `pnpm dev` builds it once first).

## Tests
- Unit tests only for non-trivial refinements (e.g. `yearFrom ≤ yearTo`, cursor schema).

## Implementation checklist
1. ✅ Package scaffold, tsc build, exports, `errors.ts`, `health.ts`. Pending: `enums.ts`, `errors.ts`, `pagination.ts` (step 1).
2. Add each module's schemas in the step that builds the module.
