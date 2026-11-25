# 0001. pnpm monorepo with Zod contracts in `packages/shared`

- Status: Accepted
- Date: 2026-11-25 (amended at scaffold, same day: NestJS 12 is ESM-only and ships Standard Schema validation)

## Context
Web (Next.js) and API (NestJS) are both TypeScript and must agree on request/response shapes. Duplicated validation drifts; a single developer can't afford contract bugs found only at runtime.

## Decision
- pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` (`@shelfwise/shared`).
- `packages/shared` contains Zod schemas, inferred DTO types (`z.infer`), enums (`ShelfStatus`, `Role`), error codes and constants (limits). No runtime dependencies besides `zod`.
- API validates with NestJS 12's built-in `StandardSchemaValidationPipe` (Zod implements Standard Schema) using those schemas; web uses the same schemas for forms and for parsing responses where useful.
- `shared` is ESM-only, built with plain `tsc` to `dist/` (`.js` + `.d.ts`). Both NestJS 12 (ESM, `nodenext`) and Next.js consume the built output; no bundler, no `transpilePackages`.
- No Turborepo: `pnpm -r` / `pnpm --filter` is enough for three packages.

## Alternatives considered
- **class-validator DTOs (NestJS default)** — can't be shared with the frontend without decorators leaking into the web bundle.
- **OpenAPI + codegen** — more moving parts than a 3-week project needs.
- **tRPC / ts-rest** — nice, but hides the "I can design a REST API" part of the portfolio and fights NestJS conventions.
- **Turborepo / Nx** — caching gains are negligible at this size.

## Consequences
- One place to change a contract; type errors surface on both sides at compile time.
- `shared` must be built before `api` typecheck/build in CI (`pnpm --filter @shelfwise/shared build` first, or `pnpm -r --workspace-concurrency=1` in topological order).
- Nest Swagger won't auto-document Zod schemas; API docs live in module specs instead (acceptable).
