import 'server-only';
import {
  BookDetail,
  BookPage,
  ReviewPage,
  SubjectList,
} from '@shelfwise/shared';
import { cacheLife } from 'next/cache';
import type { z } from 'zod';
import { getServerEnv } from '@/lib/env';

/**
 * Public catalog reads for Server Components. Talk to the API directly (server-to-server) and
 * are cached with `use cache`: the same search or book page is served from the cache for a few
 * minutes instead of hitting Render + Neon on every request. Errors are not cached.
 */
async function getPublic<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.infer<T> | null> {
  const res = await fetch(`${getServerEnv().API_ORIGIN}${path}`, {
    headers: { Accept: 'application/json' },
    // Render's free tier can take up to a minute to wake up.
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return schema.parse(await res.json());
}

/** `apiQuery` comes from `parseCatalogParams` (already validated and normalised). */
export async function searchBooks(apiQuery: string): Promise<BookPage> {
  'use cache';
  cacheLife('minutes');
  const page = await getPublic(`/books?${apiQuery}`, BookPage);
  if (!page) throw new Error('GET /books returned 404');
  return page;
}

export async function getSubjects(): Promise<SubjectList> {
  'use cache';
  cacheLife('hours');
  return (await getPublic('/books/subjects', SubjectList)) ?? { items: [] };
}

/** `null` for unknown books (and malformed ids — the API answers 404 for both). */
export async function getBook(id: string): Promise<BookDetail | null> {
  'use cache';
  cacheLife('minutes');
  return getPublic(`/books/${encodeURIComponent(id)}`, BookDetail);
}

export async function getBookReviews(id: string): Promise<ReviewPage> {
  'use cache';
  cacheLife('minutes');
  return (
    (await getPublic(
      `/books/${encodeURIComponent(id)}/reviews?limit=10`,
      ReviewPage,
    )) ?? {
      items: [],
      nextCursor: null,
    }
  );
}
