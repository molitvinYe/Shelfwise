# Product brief

## Why this exists

Shelfwise is a **portfolio project**. Its job is to convince a hiring manager or a technical interviewer, in about five minutes, that the author can design, build, test, deploy and document a production-shaped full-stack application (React / Next.js / Node.js).

It is not a commercial product. There is no revenue model; the "business" goal is **credibility**. Every decision is judged by: *does this make the demo more convincing, or just bigger?*

## Audience

| Who | What they do | What they need from Shelfwise |
|-----|--------------|-------------------------------|
| Recruiter / hiring manager | Opens the live link from a CV, clicks around for 1–2 minutes | Works on first click, looks polished, one-click demo login, AI chat that visibly works |
| Technical interviewer | Reads the README and skims the code | Clear architecture diagram, explained trade-offs, clean module boundaries, tests, green CI |
| The author | Talks through the project in interviews | Concrete stories: auth with refresh rotation, full-text search, streaming LLM with cost controls |

## Value proposition — feature → skill it demonstrates

| Feature | Skill on display |
|---------|------------------|
| Auth with rotating refresh tokens, roles | Security fundamentals, cookies, guards, token lifecycle |
| Catalog search with filters & cursor pagination | Postgres full-text search, indexing, API design |
| Shelves with optimistic UI | Client state, TanStack Query mutations, UX polish |
| Public collections with OG image | SSR/SEO, Server Components, `next/og` |
| AI advisor with tool calling & streaming | LLM integration done responsibly: grounding, streaming, abort, quotas |
| Minimal admin | RBAC enforced server-side |
| CI + deployed demo + docs | Engineering hygiene, ops on a $0 budget |

## Success criteria

The project is "done" when all of these are true:

1. **Live demo** on a public URL; "Log in as demo" works in one click.
2. A cold visitor can: search the catalog → open a book → add it to a shelf → ask the AI advisor for a recommendation → get book cards linking to real catalog pages.
3. **CI is green** on `develop` and `main` (lint, typecheck, unit + e2e tests, build).
4. README explains the system in under 5 minutes: screenshots, chat GIF, Mermaid diagram, "Decisions & trade-offs".
5. Local start is one documented command sequence.
6. Hosting cost is $0/month; the LLM cannot generate spend (free tier, no billing attached) and the app enforces its own quotas.
7. Lighthouse accessibility ≥ 90 on landing, catalog, book and collection pages; layouts work at 360px width.

## Scope

**In (MVP):** auth & roles, catalog (seed + search + import on demand), shelves/ratings/reviews, profile stats, public collections, AI advisor, minimal admin, presentation.

**Non-goals:** book clubs, reading challenges, user-written works, payments, followers/feeds, mobile app, persisted chat history, email verification / password reset, i18n.

**Anti-goals** (would make the project a failure even if it "works"):
- A demo that is broken or asleep when a recruiter opens it.
- An AI that hallucinates books that don't exist in the catalog.
- Any path by which a stranger can run up an LLM bill.
- Feature sprawl that leaves features half-finished, untested or without error states.
- Secrets committed to the repo.

## Budget

| Item | Provider | Cost |
|------|----------|------|
| Web hosting | Vercel Hobby | $0 |
| API hosting | Render free web service | $0 |
| Database | Neon free | $0 |
| LLM | Google Gemini Flash, AI Studio free tier (no billing) | $0 |
| Uptime ping | UptimeRobot / cron-job.org free | $0 |
| CI | GitHub Actions (public repo) | $0 |
| Domain (optional) | — | skip; use `*.vercel.app` |

Free-tier limits and their consequences are listed in [external-services.md](external-services.md).

## Timeline

~3 weeks part-time. Week 1: foundation, auth, catalog. Week 2: shelves, collections, admin, tests. Week 3: AI advisor, demo data, polish, README. Detailed order in [roadmap.md](roadmap.md).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Render free tier sleeps after inactivity → 30–60s cold start | Recruiter sees a hanging page | Uptime ping on `/health` every ~10 min; liveness endpoint does not touch the DB |
| Neon compute suspends when idle | First DB query after idle is slower (sub-second to a few seconds) | Accept; mention in trade-offs; ping does **not** wake the DB on purpose (saves compute hours) |
| SSE streaming breaks or times out through the Vercel → Render rewrite | AI chat unusable via one origin | ✅ Verified in production (step 5): 60 s stream through the Vercel rewrite arrives event by event ([ADR-0002](adr/0002-same-origin-api-proxy.md#verification-roadmap-step-5-2026-11-25)). Fallback kept documented in the ADR |
| Gemini free tier rate limits / quota changes | Chat returns errors under load | App-level global daily cap below provider quota; graceful "advisor is resting" state; model name in env var |
| Free-tier Gemini data may be used by Google to improve products | Privacy of demo prompts | Acceptable for a demo; disclose in the chat UI footer; never send emails or other PII to the model |
| Shared demo account abused (spam reviews, AI quota exhaustion) | Ugly public pages, chat blocked for everyone | Separate demo AI quota + per-IP limit; admin can hide reviews; optional nightly demo reset |
| Open Library slow / rate-limits during seeding | Seed fails in CI or on deploy | Fetch once into a committed JSON snapshot; seed reads the snapshot, never the network |
| Scope creep inside 3 weeks | Unfinished demo | Out-of-scope list in CLAUDE.md; roadmap has a buffer; AI advisor scoped to one chat without history persistence |
