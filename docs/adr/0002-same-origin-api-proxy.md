# 0002. Same-origin API via Next.js rewrites

- Status: Accepted — SSE through the rewrite verified in production on 2026-11-25 (see Verification)
- Date: 2026-11-25

## Context
Web is on `*.vercel.app`, API on `*.onrender.com`. Cross-site cookies are increasingly blocked by browsers (third-party cookie restrictions), and CORS with credentials adds configuration surface.

## Decision
- `next.config` rewrites `/api/:path*` → `${API_ORIGIN}/:path*`. The browser sees one origin; auth cookies are first-party with `SameSite=Lax`.
- Server Components call `API_ORIGIN` directly (server-to-server) and forward the `cookie` header when rendering personalised data.
- The API has no CORS enabled.

## Alternatives considered
- **Direct cross-origin calls with CORS + `SameSite=None`** — fragile with third-party cookie blocking (Safari ITP), more config.
- **Custom domain for both (`app.` / `api.` on the same site)** — works, but costs a domain; violates the $0 budget.
- **Next.js Route Handlers as a BFF** — duplicates every endpoint.

## Consequences
- Every API request has one extra hop through Vercel's edge; acceptable latency for a demo.
- **Risk:** long-lived SSE responses through an external rewrite may be buffered or cut by proxy timeouts. Step 5 includes a spike: a `/health/stream` endpoint that emits an event per second for 60s, checked through the deployed rewrite.
- **Fallback if the spike fails:** only `/ai/chat` is called directly at the API origin; the API enables CORS for `WEB_ORIGIN` on that route, and the chat authenticates with a short-lived, single-purpose token fetched from `/api/ai/session` (same-origin) and sent as `Authorization: Bearer`. Cookies stay same-origin. Record the outcome as ADR-0008 if triggered.
- The API must trust the proxy (`app.set('trust proxy', ...)`) and read the client IP from `x-forwarded-for` for rate limiting.

## Verification (roadmap step 5, 2026-11-25)

`GET https://shelfwise-khaki.vercel.app/api/health/stream?seconds=60` (Vercel production → external rewrite → Render free instance in Frankfurt):

- 60 of 60 events received, one per second, each arriving as it was produced (no buffering), stream closed cleanly at 60 s.
- Response headers through the edge: `content-type: text/event-stream`, `cache-control: …, no-transform`, `x-vercel-cache: MISS`.
- Same result directly against `https://shelfwise-api-mhic.onrender.com`.

**Verdict:** the fallback (direct cross-origin chat endpoint) is not needed. The AI chat streams through `/api/*` on the web origin. Re-test if the hosting setup changes (custom domain, different API host).

