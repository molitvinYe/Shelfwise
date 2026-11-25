# Infrastructure: local setup, CI, deploy, observability

> Roadmap: steps 2, 4, 5, 18 · Decisions: [ADR-0002](../adr/0002-same-origin-api-proxy.md), [ADR-0007](../adr/0007-free-tier-hosting.md)

## Local development
- **Prereqs:** Node LTS (pinned in `.nvmrc` and `engines`), pnpm via Corepack (`packageManager` field), Docker.
- `docker-compose.yml`:
  - `db` — `postgres:17`, port 5432, db `shelfwise`, named volume, healthcheck `pg_isready`.
  - `db-test` — `postgres:17`, port 5433, db `shelfwise_test`, `tmpfs` data dir (fast, disposable).
- One-command start (target):
  ```bash
  cp .env.example .env        # per app: apps/api/.env, apps/web/.env.local
  docker compose up -d
  pnpm install
  pnpm db:migrate && pnpm db:seed
  pnpm dev                    # shared (watch) + api (watch) + web, in parallel
  ```
- Root scripts proxy to workspaces: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`, `data:fetch`, `format`.

## Code quality
- ESLint (flat config) shared base at the root + Next and Nest overrides; `@typescript-eslint/no-explicit-any: error`.
- Prettier; `lint-staged` + `simple-git-hooks` (lighter than husky) for pre-commit format/lint.
- `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (drop the last one if it fights Prisma types — note it in the config).

## CI (GitHub Actions) — `.github/workflows/ci.yml`
Trigger: PRs and pushes to `main`.

```
setup (checkout, pnpm/action-setup, setup-node with pnpm cache, pnpm install --frozen-lockfile)
  → build shared
  → lint
  → typecheck (all packages)
  → unit tests
  → e2e tests (services: postgres:17; prisma migrate deploy on shelfwise_test)
  → build api + web
```
- Single job with sequential steps is enough (fast feedback, one cache); split into jobs only if it gets slow.
- `concurrency` group per branch with `cancel-in-progress`.
- No secrets needed in CI (Gemini is mocked; test DB is the service container).

## Deploy
| Target | Setup |
|--------|-------|
| **Neon** | Project + `main` branch DB. Copy pooled URL → `DATABASE_URL`, direct URL → `DIRECT_URL`. Optional: a `preview` branch for testing migrations. |
| **Render** | Web service from the GitHub repo, region close to Neon's. Root: repo root. Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @shelfwise/api... build`. Start: `pnpm --filter @shelfwise/api start:prod` (`prisma migrate deploy && node dist/main.js`). Health check path `/health`. Auto-deploy on `main`. Env vars from [external-services.md](../external-services.md#environment-variables). Optionally `render.yaml` blueprint in repo. |
| **Vercel** | Import repo, Root Directory `apps/web`, framework Next.js, install command uses pnpm at the workspace root (Vercel detects it). Env `API_ORIGIN`, `NEXT_PUBLIC_SITE_URL`. Preview deploys for PRs point to the prod API (acceptable for a demo) — or disable previews' API-dependent pages. |
| **Seed in prod** | Run once from local machine: `DATABASE_URL=<neon direct> pnpm db:seed`. Never from the Render start command. |

## Observability
- Structured logs (`nestjs-pino`) visible in Render's log viewer; request id in every line and in `x-request-id`.
- Uptime pinger on `/health` (also gives an uptime history to show).
- Optional (non-MVP): Sentry free tier for web + api errors.

## Security baseline
- `helmet` on the API; `x-powered-by` off.
- Secrets only in provider env settings; `.env*` gitignored except `.env.example`.
- GitHub: Dependabot for npm + actions (weekly), branch protection on `main` requiring CI.

## Optional jobs (GitHub Actions `schedule`)
- **Nightly demo reset** (step 17, if time): calls `POST /admin/demo/reset` with a `CRON_SECRET` header → restores the demo user's shelves/collections/reviews from seed fixtures.
- Expired refresh token cleanup can piggyback on the same job.

## Implementation checklist
1. Docker Compose, `.env.example` files, root scripts (step 2).
2. Lint/format/hooks, tsconfig base (step 1–2).
3. CI workflow (step 4).
4. Neon + Render + Vercel deploy of the skeleton, SSE spike, pinger (step 5).
5. Logging, helmet, Dependabot, branch protection (step 5 / 18).
