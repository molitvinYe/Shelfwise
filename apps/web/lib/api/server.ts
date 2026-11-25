import 'server-only';
import {
  AuthResponse,
  MyShelfEntry,
  type PublicUser,
  type ShelfEntry,
} from '@shelfwise/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import { getServerEnv } from '@/lib/env';

/**
 * The signed-in user for this request, or `null` when logged out.
 * Talks to the API directly (server-to-server) with the access cookie; `proxy.ts` has already
 * refreshed it if it was expired. Deduplicated per request with `React.cache`.
 * Throws if the API is unreachable, so callers can tell "logged out" from "API down".
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return null;

  const res = await fetch(`${getServerEnv().API_ORIGIN}/auth/me`, {
    headers: {
      Cookie: `${ACCESS_COOKIE}=${access}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`);
  return AuthResponse.parse(await res.json()).user;
});

/**
 * The signed-in user's shelf entry for a book (`null` when not shelved), read per request.
 * Callers check `getCurrentUser()` first; a missing session here also yields `null`.
 */
export async function getMyShelfEntry(
  bookId: string,
): Promise<ShelfEntry | null> {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!access) return null;

  const res = await fetch(
    `${getServerEnv().API_ORIGIN}/shelves/me/books/${encodeURIComponent(bookId)}`,
    {
      headers: {
        Cookie: `${ACCESS_COOKIE}=${access}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (res.status === 401) return null;
  if (!res.ok)
    throw new Error(`GET /shelves/me/books/:id failed with ${res.status}`);
  return MyShelfEntry.parse(await res.json()).entry;
}
