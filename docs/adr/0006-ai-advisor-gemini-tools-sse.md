# 0006. AI advisor: Gemini Flash, tool calling, SSE, layered quotas

- Status: Accepted
- Date: 2026-11-25

## Context
The advisor is the headline feature. It must (1) recommend only real catalog books, (2) stream, (3) be impossible to turn into a bill, on a $0 budget.

## Decision
- **Provider:** Google Gemini Flash (cheapest current Flash / Flash-Lite model with tool calling) via AI Studio API key, **free tier with no billing account attached** — the provider-side hard spend limit is $0 by construction. Model id in env `AI_MODEL`.
- **SDK:** Vercel AI SDK (`ai` + `@ai-sdk/google`) on the API; `@ai-sdk/react` `useChat` on the web. Switching provider is a one-line change.
- **Tools** (all read-only, scoped to the current user):
  - `searchCatalog({ query, subjects?, yearFrom?, yearTo?, language?, limit≤10 })` → compact book list (id, title, authors, year, subjects).
  - `getUserShelves({ status? })` → the user's books with status and rating (max 50, compact).
  - `showRecommendations({ items: [{ bookId, reason }] ≤ 5 })` → server verifies every `bookId` exists, drops unknown ones, returns full book cards. **The UI renders cards only from this tool's output**, so a hallucinated title can't become a card.
- **Streaming:** AI SDK UI message stream (SSE) piped to the Express response. `req.on('close')` → `AbortController.abort()` → upstream generation cancelled.
- **Bounds per call:** `maxOutputTokens` (env, e.g. 800), max tool steps (e.g. 5), 60s overall timeout, `temperature` low-ish.
- **Input bounds:** ≤ 20 messages and ≤ 2,000 chars per user message (Zod); server keeps only the last N messages. No chat history persistence.
- **Quotas (checked before calling the model, atomic upsert on `AiUsage`):**
  1. per-user daily requests (`AI_DAILY_REQUESTS_PER_USER`, e.g. 20);
  2. demo user: separate lower cap **and** per-IP daily cap (shared account);
  3. global daily cap across all users (`AI_GLOBAL_DAILY_REQUESTS`), set below the provider's free daily quota.
  Tokens are recorded in `onFinish` for visibility.
- **Prompting:** system prompt states the catalog-only rule, asks the model to call `getUserShelves` first when the user hasn't stated preferences, and to finish with `showRecommendations`.

## Alternatives considered
- **Anthropic Haiku / OpenAI mini** — strong tool calling, but paid from the first request; spend limits are monthly caps, not $0.
- **RAG with embeddings (pgvector)** — better semantic matching, but adds an embedding pipeline; FTS tool calls are enough for the demo and easier to explain. Possible stretch goal.
- **WebSockets** — bidirectional not needed; SSE works over plain HTTP and the rewrite (to be verified).

## Consequences
- Free-tier rate limits can be hit; UI must show a friendly 429 state ("The advisor is resting — try again later").
- Free-tier prompts may be used by Google for product improvement; disclosed in the chat footer. No PII is sent: no email or display name, the model sees only books, statuses and ratings.
- Quota check-and-increment must be atomic (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING requests`) to avoid races.
- Tests use the AI SDK mock language model; Gemini is never called in CI.
