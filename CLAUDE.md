# Shelfwise

Book-tracking platform with an AI reading advisor. Portfolio project to demonstrate full-stack skills (React / Next.js / Node.js). Not a commercial product: prefer a polished, deployed, well-documented demo over feature breadth.

- Timeline: ~3 weeks, part-time.
- Hosting budget: ~$0/month (free tiers). LLM: Google Gemini Flash on the free tier (no billing account attached = hard spend limit of $0).

## Documentation map

Read the relevant doc before working on a module. Keep docs in sync with the code in the same change.

| Doc | What it covers |
|-----|----------------|
| [docs/product-brief.md](docs/product-brief.md) | Why the project exists, audience, success criteria, scope, budget, risks |
| [docs/architecture.md](docs/architecture.md) | System diagram, deploy topology, monorepo layout, request flows, data model, API conventions |
| [docs/adr/](docs/adr/README.md) | Architecture Decision Records — the "why" behind key choices |
| [docs/modules/](docs/modules/README.md) | One spec per module: responsibility, data, endpoints, UI, tests, dependencies |
| [docs/roadmap.md](docs/roadmap.md) | Step-by-step implementation order with external resources per step |
| [docs/external-services.md](docs/external-services.md) | Accounts, API keys, env variables, free-tier limits |

## Stack

**Monorepo:** pnpm workspaces
- `apps/web` — Next.js (App Router), React, TypeScript (strict), Tailwind CSS, TanStack Query for client mutations
- `apps/api` — NestJS, TypeScript (strict), Prisma ORM
- `packages/shared` — Zod schemas and DTO types used by both web and api

**Data:** PostgreSQL (Neon in prod, Docker Compose locally). Book data seeded from the Open Library API.
**Auth:** short-lived access JWT + rotating refresh token, both in httpOnly Secure cookies; refresh token hashes stored in DB; passwords hashed with argon2.
**AI:** Gemini Flash via Vercel AI SDK (`@ai-sdk/google`) on the API side; streaming over SSE; tool calling against our own catalog.
**Testing:** Vitest (unit), Vitest + Supertest against a test DB (e2e), optional Playwright smoke tests.
**CI:** GitHub Actions — lint → typecheck → test → build.
**Deploy:** Vercel (web), Render (api, free tier + uptime ping on `/health`), Neon (db).

## Architecture decisions (summary — details in docs/adr)

- Next.js `rewrites` proxy `/api/*` to the NestJS API → one origin in the browser, first-party cookies, no CORS.
- Validation schemas live once in `packages/shared` and are reused on both sides.
- Open Library is a data source, not our database: books are imported into Postgres. Search uses Postgres full-text (`tsvector` + GIN). Missing books can be imported on demand.
- Cursor-based pagination for all lists.
- Server Components for public pages (catalog, book, collection) with `generateMetadata`; client components for interactive parts (shelves, chat).
- NestJS feature modules: `auth`, `users`, `books`, `shelves`, `collections`, `ai`, `admin`, `health`.
- The AI may only recommend books from our catalog; recommendations are rendered from tool results, not free text.

## Out of scope

Book clubs, reading challenges, publishing user-written works, payments, social features (followers, feeds), mobile app, persisted chat history. Don't add them unless explicitly asked.

## Conventions

- TypeScript strict everywhere; no `any` without a comment explaining why.
- Validate all input at the API boundary with shared Zod schemas.
- Error responses: `{ "error": { "code", "message", "details?" } }`; list responses: `{ "items", "nextCursor" }`.
- Every async UI has loading, empty and error states; accessibility and responsive layout are part of "done".
- Conventional Commits (`feat(api): ...`, `fix(web): ...`, `docs: ...`).
- **No AI attribution anywhere:** no `Co-Authored-By: Claude` trailers, no "Generated with Claude Code" lines or 🤖 markers in commits, PRs, issues, code or docs.
- Keep `.env.example`, this file and `docs/` up to date when env variables, commands or architecture change.

## Git workflow

- **`develop`** — default branch and integration branch. All work branches start from `develop` and merge back into it via PR.
- **`main`** — production. Only updated by a release PR `develop → main`; production deploys (Vercel production, Render) build from `main`.
- Work branches: `feat/<scope>-<topic>`, `fix/...`, `chore/...`, `docs/...` — one roadmap step or task per branch.
- **Merge methods:** work PRs into `develop` → *Squash and merge*. Release PRs `develop → main` and sync PRs back into `develop` → **Create a merge commit**, never squash (squash leaves a commit on `main` that `develop` doesn't have, and the next release PR is blocked as out of date).
- Never commit directly to `develop` or `main`; never force-push them. Both are protected: merging requires the green CI check **`Lint, typecheck, test, build`** (`.github/workflows/ci.yml`).
- Before pushing, run what CI runs: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`.

## Commands

Run from the repo root (pnpm 10 via Corepack: `corepack enable pnpm`).

| Command | What it does |
|---------|--------------|
| `pnpm dev` | build shared, then shared (watch) + api :4000 (watch) + web :3000 |
| `pnpm build` | build all packages (topological order) |
| `pnpm lint` | ESLint in `apps/web`, oxlint (type-aware) in `apps/api` |
| `pnpm typecheck` | build shared, then `tsc --noEmit` everywhere |
| `pnpm test` | unit tests (Vitest) |
| `pnpm test:e2e` | API e2e tests (Vitest + Supertest) |
| `pnpm format` / `pnpm format:check` | Prettier (Markdown excluded) |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:reset` | local Postgres via Docker Compose: dev `:5432`, test `:5433` (in-memory); reset wipes dev data |
| `pnpm --filter @shelfwise/<pkg> <script>` | run a script in one package |

| `pnpm db:migrate` | create/apply a migration in dev (`prisma migrate dev`; add `--create-only` via the api package to hand-edit SQL first) |
| `pnpm db:migrate:deploy` | apply pending migrations (prod/CI) |
| `pnpm db:generate` | regenerate Prisma Client (also runs on `pnpm install`) |
| `pnpm db:studio` | Prisma Studio |

_Added in later steps: `db:seed`, `data:fetch` (step 7)._

Pre-commit hook (`simple-git-hooks` + `lint-staged`): Prettier on staged files, then lint of the touched app. Skip once with `SKIP_SIMPLE_GIT_HOOKS=1 git commit ...` only when really needed.

## Tooling notes

- **ESM everywhere.** NestJS 12 is ESM-only: relative imports in `apps/api` and `packages/shared` end in `.js`; use `import.meta.dirname`, not `__dirname`.
- **Tests run on Vitest** (Nest 12 default): `vi.fn()`, not `jest.fn()`.
- **Validation:** Nest 12's `StandardSchemaValidationPipe` with shared Zod schemas (`@Body({ schema })`). No class-validator.
- **TypeScript is pinned to `~6.0`.** TS 7 is out, but `typescript-eslint` and the Nest CLI don't support it yet.
- **`@shelfwise/shared` must be built** before api/web can resolve it; the root scripts handle that.
- **Next.js 16 conventions:** `middleware.ts` is called `proxy.ts`; Cache Components and Partial Prefetching are on. Read `apps/web/node_modules/next/dist/docs/` before using unfamiliar Next APIs (see `apps/web/AGENTS.md`).
- **API errors:** throw `AppException(status, code, message, details?)` from `apps/api/src/common/errors`; the global `AllExceptionsFilter` renders the shared `ApiErrorBody`. Unexpected errors become `500 INTERNAL_ERROR` without internals.
- **Logging:** `nestjs-pino`; inject `PinoLogger` (`@InjectPinoLogger(Context.name)`). Every response carries `x-request-id`.
- **App setup shared with e2e:** `configureApp()` in `apps/api/src/app.setup.ts` (helmet, trust proxy); e2e tests must call it.
- **Prisma 7:** client is generated into `apps/api/src/generated/prisma` (gitignored) — import `PrismaClient`/types from `../generated/prisma/client.js`, not `@prisma/client`. Inject `PrismaService` (global `PrismaModule`). The app uses the pooled `DATABASE_URL` via `@prisma/adapter-pg`; the CLI uses `DIRECT_URL` from `prisma.config.ts`.
- **Hand-written SQL in migrations:** the `Book.searchVector` trigger and CHECK constraints live in `prisma/migrations/*_init/migration.sql`; Prisma doesn't diff them. Full-text queries must use `websearch_to_tsquery('english', …)` — the same config as the trigger.
- **e2e tests use the real test DB** (`db-test`, `:5433`): `test/global-setup.ts` runs `migrate deploy`; files run sequentially; use `createTestPrisma()` / `resetDatabase()` from `test/db.ts`.
- `apps/api/AGENTS.md` holds NestJS 12 framework notes from the generator.
