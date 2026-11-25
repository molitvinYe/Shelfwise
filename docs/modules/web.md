# apps/web (Next.js)

> Roadmap: steps 1, 6, 8, 10–12, 16, 19 · Depends on: `@shelfwise/shared`, API via `/api/*`

## Purpose
The UI. Public pages are Server Components (SEO, fast first paint); interactive parts are client components using TanStack Query for mutations.

## Routes

| Route | Type | Auth | Content |
|-------|------|------|---------|
| `/` | RSC | public | Landing: pitch, "Log in as demo", "Browse catalog", screenshot of the advisor |
| `/login`, `/register` | client form | guest only | forms with shared Zod schemas (`react-hook-form` + `zodResolver`) |
| `/books` | RSC + client filters | public | search box, filters (subject, year range, language), sort, results grid, "Load more" (`?cursor=`); empty state offers "Import from Open Library" |
| `/books/[id]` | RSC + client islands | public | cover, metadata, description, rating summary, reviews (paginated); `ShelfButton`, `RatingStars`, `ReviewForm` (client, if logged in); `generateMetadata` |
| `/me` | RSC | user | my shelves (tabs WANT/READING/READ, infinite list), stats cards |
| `/u/[id]` | RSC | public | public profile: display name, stats, shelves |
| `/collections` | RSC + client | user | my collections, create dialog |
| `/collections/[id]` | client | owner | editor: title/description/public toggle, add book (search), drag & keyboard reorder, remove, copy public link |
| `/c/[slug]` | RSC | public | public collection; `generateMetadata` + `opengraph-image.tsx` |
| `/advisor` | client | user | AI chat |
| `/admin/reviews`, `/admin/users` | RSC + client | admin | moderation tables |

## Data fetching
- **Server:** `lib/api/server.ts` — `apiFetch(path, { forwardCookies })` against `API_ORIGIN`, parses responses with shared schemas, maps errors to typed `ApiError`. Public pages use `next: { revalidate: 300 }` (catalog, book, public collection); personalised pages use `cache: 'no-store'`.
- **Client:** `lib/api/client.ts` — `fetch('/api/...')` with `credentials: 'same-origin'`; on `401 TOKEN_EXPIRED` performs one `/api/auth/refresh` (single-flight: concurrent requests await the same refresh promise) and retries once; on failure → redirect to `/login`.
- **TanStack Query:** `QueryClientProvider` in a client `Providers` component; query keys in `lib/query-keys.ts`. Mutations with optimistic updates:
  - shelf status/rating: `onMutate` update cache → `onError` roll back + toast → `onSettled` invalidate.
  - collection reorder: same pattern.
- After mutations that affect server-rendered pages, call `router.refresh()`.

## Auth on the web
- `proxy.ts` (Next 16 name for middleware), matcher on `/me`, `/collections/:path*`, `/advisor`, `/admin/:path*`, and pages that show `myShelf`:
  1. If `sw_access` is present and not expired (decode `exp` only — verification happens in the API) → continue.
  2. Else if `sw_refresh` is present → call `${API_ORIGIN}/auth/refresh` server-side forwarding the cookie, copy `Set-Cookie` onto the response, continue.
  3. Else on protected routes → redirect to `/login?next=...`.
- Role check for `/admin` in the admin layout (RSC calls `/auth/me`); real enforcement is the API.
- `getCurrentUser()` server helper (cached per request with `React.cache`).

## AI chat UI
- `useChat` from `@ai-sdk/react` with transport pointing to `/api/ai/chat`.
- Renders message parts: text (streaming), tool states (`searchCatalog` → "Searching the catalog…", `getUserShelves` → "Looking at your shelves…"), `showRecommendations` output → `BookCard` grid with reason and link.
- Stop button → `stop()`; quota counter from `/api/ai/usage`; error states: 429 (with reset time), 503 disabled, network/stream error with retry.
- Suggested prompts for empty state ("Something like *The Martian* but shorter").
- Footer note: AI may be wrong; prompts processed by Google Gemini.

## UI foundation
- Tailwind with design tokens (CSS variables) for colors, light/dark via `prefers-color-scheme`.
- Small set of primitives in `components/ui/` (Button, Input, Select, Dialog, Tabs, Toast, Skeleton, EmptyState, ErrorState). Use Radix primitives (or shadcn/ui generated components) for accessible dialogs/menus/tabs instead of hand-rolling.
- Every data view: skeleton loading, empty state, error state with retry (`error.tsx` per route segment + `loading.tsx`).
- Accessibility: semantic landmarks, labelled form fields, focus visible, keyboard reorder (`@dnd-kit` keyboard sensor), star rating as radio group, color contrast AA. `not-found.tsx` for 404s.
- Responsive: mobile-first, works at 360px.
- Covers via plain `<img>` (or `next/image` with `unoptimized`) with width/height to avoid layout shift and `loading="lazy"`.

## Config (env)
`API_ORIGIN` (server-only; used in rewrites, middleware and RSC fetches), `NEXT_PUBLIC_SITE_URL` (canonical URLs, OG). Validated with Zod in `lib/env.ts`.

## Tests
- Component tests only where logic exists: optimistic `ShelfButton` rollback, refresh single-flight in the client fetcher, reorder list keyboard behaviour.
- Optional Playwright smoke (step 19): demo login → search → add to shelf → open public collection.

## Implementation checklist
1. `create-next-app` (TS, Tailwind, App Router, ESLint), strict TS, rewrites, env validation (step 1) ✅.
2. Layout, nav, UI primitives, Providers (step 1/6).
3. Auth pages, middleware, fetchers, landing with demo button (step 6).
4. Catalog + book page (step 8), import dialog (step 9).
5. Shelf controls, profile pages (steps 10–11).
6. Collections pages + OG image (step 12).
7. Admin pages (step 13).
8. Advisor (step 16).
9. Polish pass: a11y, empty/error states, Lighthouse (step 18).
