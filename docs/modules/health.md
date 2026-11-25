# health

> Roadmap: steps 3, 5 · Depends on: PrismaModule

## Purpose
Liveness for the uptime pinger, readiness for deploy checks, and a temporary streaming probe to validate SSE through the Vercel rewrite.

## Owns (data)
Nothing.

## Endpoints

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | public | `200 { status: "ok", uptime, version }` — **no DB access** |
| GET | `/health/ready` | public | `200 { status: "ok", db: "ok" }` or `503` if `SELECT 1` fails within 3s |
| GET | `/health/stream` | public, **non-prod only or behind a flag** | SSE: one event per second for 60s (spike for [ADR-0002](../adr/0002-same-origin-api-proxy.md)) |

## Business rules
- `/health` must stay DB-free: the pinger calls it every ~10 min and must not keep Neon awake.
- `version` = git SHA from `RENDER_GIT_COMMIT` (Render provides it) or `dev`.
- Excluded from throttling and from request logging at `info` level (log at `debug`), so pings don't flood logs.

## Security
- No sensitive data in responses. `/health/stream` disabled when `ENABLE_DEBUG_ROUTES` is not `true`.

## Tests
- e2e: `/health` returns 200 without a DB connection (start app with Prisma mocked/unreachable); `/health/ready` returns 503 when DB is down.

## Implementation checklist
1. ✅ `HealthController` with `/health` and `/health/ready` (step 3).
2. `/health/stream` behind `ENABLE_DEBUG_ROUTES` (step 5); remove or keep disabled after the spike.
3. Configure the pinger (see [external-services.md](../external-services.md#uptime-pinger)).
