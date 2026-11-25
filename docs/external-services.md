# External services

Everything outside this repo the project depends on. All are free tiers. **Free-tier limits change — re-check the provider's pricing page when setting each one up** and update this file.

## Summary

| Service | Purpose | Plan | Needed from step | Key limits to respect |
|---------|---------|------|------------------|-----------------------|
| GitHub | repo, Actions CI, Dependabot, optional cron | Free, public repo | 0 | Actions minutes are free for public repos; scheduled workflows may be delayed and are disabled after 60 days of repo inactivity |
| Neon | production Postgres | Free | 5 | small storage quota (plenty for ~5k books); monthly compute-hours quota; compute auto-suspends when idle → resume latency |
| Render | NestJS API hosting | Free web service | 5 | spins down after ~15 min without traffic (cold start ~30–60s); monthly free instance-hours ≈ one always-on service; limited RAM; no pre-deploy hook |
| Vercel | Next.js hosting | Hobby | 5 | non-commercial use only (fits); image-optimisation quota → covers served unoptimised; function duration limits (API is not on Vercel, so OK) |
| UptimeRobot (or cron-job.org) | keep Render awake, uptime history | Free | 5 | 5-min minimum interval on free UptimeRobot — good |
| Open Library | catalog source, covers | Free, no key | 7 | be polite: low concurrency, descriptive `User-Agent` with contact; covers API rate-limits non-ID lookups (we always use cover IDs) |
| Google AI Studio — Gemini Flash | AI advisor | Free tier, **no billing account** | 15 | per-model RPM / requests-per-day / tokens-per-minute limits; free-tier data may be used to improve Google products |
| Sentry (optional) | error tracking | Developer (free) | 18 | event quota per month |

## Setup notes

### Neon
1. Create project (region close to the Render region, e.g. both in EU-Central/Frankfurt or both in US-East).
2. Copy **two** connection strings: pooled (host contains `-pooler`) → `DATABASE_URL` (append `?sslmode=require&pgbouncer=true` if required by the Prisma version); direct → `DIRECT_URL`.
3. In `schema.prisma`: `datasource db { url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }`.
4. Run migrations and seed **from your machine** once: `pnpm db:migrate:deploy && pnpm db:seed` with prod env.

### Render
1. New → Web Service → connect the GitHub repo → runtime Node.
2. Build / start commands from [modules/infra.md § Deploy](modules/infra.md#deploy).
3. Health check path: `/health`.
4. Add env vars (table below). Use "Generate" for secrets like `JWT_ACCESS_SECRET`.
5. Pick the region matching Neon.

### Vercel
1. Import repo → Root Directory `apps/web` → Framework Next.js (pnpm workspace auto-detected).
2. Env vars: `API_ORIGIN=https://<api>.onrender.com`, `NEXT_PUBLIC_SITE_URL=https://<web>.vercel.app`.
3. After first deploy, set `WEB_ORIGIN` on Render to the Vercel URL (used by the API's Origin check).

### Uptime pinger
- UptimeRobot → HTTP(s) monitor → `https://<api>.onrender.com/health` → interval 5–10 min.
- Ping the **API's own URL**, not the Vercel rewrite (fewer hops, doesn't count against Vercel).
- `/health` does not touch the DB, so Neon still suspends when idle (saves compute hours).

### Open Library
- No account. Set `OPEN_LIBRARY_CONTACT` (your email or repo URL) — used in the `User-Agent`. Keep it out of the repo if it's personal (env var).
- Endpoints used: `/subjects/{subject}.json`, `/works/{olKey}.json`, `/authors/{key}.json`, `/search.json`, covers `https://covers.openlibrary.org/b/id/{coverId}-{S|M|L}.jpg`.

### Google AI Studio (Gemini)
1. Create an API key in Google AI Studio.
2. **Do not link a billing account** to the key's Google Cloud project — this is what makes the provider-side spend limit $0. (Google Cloud *budgets* only alert, they don't cap spend; staying on the free tier is the actual hard limit.)
3. Pick the cheapest current Flash / Flash-Lite model that supports function calling → `AI_MODEL`.
4. Read its free-tier limits (RPM, RPD) → set `AI_GLOBAL_DAILY_REQUESTS` to ~70% of RPD.
5. Key goes only into Render env and your local `apps/api/.env`.

## Environment variables

### `apps/api`

| Variable | Required | Example / default | Notes |
|----------|----------|-------------------|-------|
| `NODE_ENV` | yes | `development` / `production` | toggles `Secure` cookies, log format |
| `PORT` | no | `4000` | Render sets `PORT` |
| `DATABASE_URL` | yes | `postgresql://postgres:postgres@localhost:5432/shelfwise` | pooled URL in prod |
| `DIRECT_URL` | yes | same as above locally | direct URL in prod, for migrations |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 random chars | |
| `ACCESS_TOKEN_TTL_SECONDS` | no | `900` | |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | |
| `WEB_ORIGIN` | yes | `http://localhost:3000` | allowed `Origin` for mutating requests |
| `LOG_LEVEL` | no | `info` | `silent` in tests (set by Vitest config); `pino-pretty` output in development |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed only | — | creates first admin if absent |
| `DEMO_USER_EMAIL` | seed only | `demo@shelfwise.dev` | demo user has no usable password |
| `OPEN_LIBRARY_CONTACT` | yes | email or repo URL | in `User-Agent` |
| `AI_ENABLED` | no | `true` | kill switch |
| `GOOGLE_GENERATIVE_AI_API_KEY` | if AI enabled | — | AI Studio key |
| `AI_MODEL` | if AI enabled | a current Gemini Flash / Flash-Lite id | |
| `AI_MAX_OUTPUT_TOKENS` | no | `800` | |
| `AI_DAILY_REQUESTS_PER_USER` | no | `20` | |
| `AI_DAILY_REQUESTS_DEMO_USER` | no | `100` | shared demo account total |
| `AI_DAILY_REQUESTS_DEMO_PER_IP` | no | `5` | |
| `AI_GLOBAL_DAILY_REQUESTS` | no | `500` | keep below provider RPD |
| `IP_HASH_SALT` | if AI enabled | random | hashing IPs for `AiIpUsage` |
| `ENABLE_DEBUG_ROUTES` | no | `false` | `/health/stream` spike |
| `CRON_SECRET` | optional | random | nightly demo reset |
| `TEST_DATABASE_URL` | tests | `postgresql://postgres:postgres@localhost:5433/shelfwise_test` | e2e |

### `apps/web`

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `API_ORIGIN` | yes | `http://localhost:4000` | server-only: rewrites, middleware, RSC fetches |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` | canonical URLs, OG images |

Both apps validate their env at startup (Zod) and exit with a clear error when a required variable is missing. `.env.example` files are created in roadmap step 2 and must mirror these tables.
