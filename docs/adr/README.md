# Architecture Decision Records

Short records of decisions that are expensive to reverse. One file per decision, numbered, never rewritten — a changed decision gets a new ADR that supersedes the old one.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-monorepo-and-shared-contracts.md) | pnpm monorepo with Zod contracts in `packages/shared` | Accepted |
| [0002](0002-same-origin-api-proxy.md) | Same-origin API via Next.js rewrites | Accepted (verify SSE in step 5) |
| [0003](0003-auth-jwt-refresh-rotation.md) | Access JWT + rotating refresh token in httpOnly cookies | Accepted |
| [0004](0004-catalog-in-postgres-fts.md) | Own catalog in Postgres with full-text search; Open Library as import source | Accepted |
| [0005](0005-cursor-pagination.md) | Cursor (keyset) pagination for all lists | Accepted |
| [0006](0006-ai-advisor-gemini-tools-sse.md) | AI advisor: Gemini Flash, tool calling, SSE, layered quotas | Accepted |
| [0007](0007-free-tier-hosting.md) | Free-tier hosting: Vercel + Render + Neon | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What forces are at play.

## Decision
What we do.

## Alternatives considered
Option — why not.

## Consequences
What becomes easier, what becomes harder, what we must watch.
```
