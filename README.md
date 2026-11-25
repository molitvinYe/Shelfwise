# Shelfwise

Track what you read, rate and review books, curate public collections — and ask an AI reading advisor what to read next, grounded in a real catalog.

> **Status:** monorepo scaffold (roadmap step 1). Landing page + API health check run locally — features land step by step, see the [roadmap](docs/roadmap.md).
> Screenshots, live demo link and a chat GIF will be added in roadmap step 19.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · TanStack Query · NestJS · Prisma · PostgreSQL · Zod · Vercel AI SDK + Gemini Flash · Vitest · GitHub Actions · Vercel · Render · Neon

## Documentation

- [Product brief](docs/product-brief.md) — goals, audience, scope, budget, risks
- [Architecture](docs/architecture.md) — diagrams, data model, request flows, API conventions
- [Decisions (ADRs)](docs/adr/README.md) — why things are built the way they are
- [Module specs](docs/modules/README.md) — per-module plan
- [Roadmap](docs/roadmap.md) — implementation order
- [External services](docs/external-services.md) — accounts, keys, env variables

## Local development

Prerequisites: Node 24 (`.nvmrc`), Corepack (ships with Node), a Docker runtime with Compose v2 (Docker Desktop, OrbStack or Colima).

```bash
corepack enable pnpm                        # once per machine: puts pnpm 10 on PATH
pnpm install                                # also installs the pre-commit hook
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                  # Postgres for dev (:5432) and tests (:5433)
pnpm dev
```

- Web: http://localhost:3000 — landing page with a live "System status" card
- API: http://localhost:4000/health (also reachable through the web proxy at http://localhost:3000/api/health)

The database is not used by the app yet — Prisma arrives in roadmap step 3.

| Command | What it does |
|---------|--------------|
| `pnpm dev` | builds `@shelfwise/shared`, then runs shared (watch), api (watch) and web in parallel |
| `pnpm build` | builds all packages in dependency order |
| `pnpm lint` | ESLint (web), oxlint (api) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | unit tests (Vitest) |
| `pnpm test:e2e` | API e2e tests (Vitest + Supertest) |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm db:up` / `db:down` / `db:reset` | start / stop / wipe local Postgres (Docker Compose) |
