# 0007. Free-tier hosting: Vercel + Render + Neon

- Status: Accepted
- Date: 2026-11-25

## Context
$0/month, but the demo must be up when a recruiter clicks. NestJS needs a long-running Node process (SSE), which rules out pure serverless for the API.

## Decision
- **Vercel Hobby** for `apps/web` (native Next.js, preview deploys per PR).
- **Render free web service** for `apps/api` (long-running Node, supports streaming). Kept awake by an external pinger hitting `GET /health` every ~10 minutes.
- **Neon free** Postgres. App uses the **pooled** connection string; migrations use the **direct** one (`DIRECT_URL`).
- `GET /health` is a liveness check that **does not touch the DB**, so the pinger keeps Render awake without burning Neon compute hours. `GET /health/ready` checks the DB and is used manually / by deploy checks.
- Migrations run in the Render start command (`prisma migrate deploy && node dist/main.js`) because the free tier has no pre-deploy hook.

## Alternatives considered
- **API on Vercel serverless functions** — NestJS cold starts, function duration limits for SSE.
- **Fly.io / Railway** — no longer reliably free.
- **Supabase Postgres** — fine alternative; Neon chosen for branching and the pooled/direct URL setup with Prisma.

## Consequences
- First DB query after idle may take extra time (Neon resume). Documented in README trade-offs.
- One always-on Render service fits the free monthly instance-hours; don't create a second always-on free service.
- Render free instances have limited RAM — keep the API lean (no heavy in-memory caches).
