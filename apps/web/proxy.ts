import { decodeJwt } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/cookies';
import { safeNext } from '@/lib/auth/safe-next';
import { getServerEnv } from '@/lib/env';

/** Pages that need a session; the pages re-check on the server, this only saves a round trip. */
const PROTECTED_PREFIXES = ['/me'];
/** Pages that make no sense with a session. */
const GUEST_ONLY = ['/login', '/register'];
/** Refresh a bit before expiry so the token doesn't die mid-render. */
const EXPIRY_SKEW_MS = 10_000;

/**
 * Silent session refresh for server rendering (docs/modules/web.md#auth-on-the-web):
 * when the access token is missing or expired but a refresh token exists, rotate it against the
 * API before the page renders, so Server Components see a valid session. The new cookies are
 * applied to both the forwarded request and the browser response.
 * The JWT is only decoded here (expiry check); the API verifies the signature.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  let signedIn = isFresh(access);
  let setCookies: string[] = [];

  if (!signedIn && refresh) {
    const res = await fetch(`${getServerEnv().API_ORIGIN}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE}=${refresh}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    // On a network error keep the cookies: the session may still be fine once the API is back.
    if (res) {
      setCookies = res.headers.getSetCookie();
      signedIn = res.ok;
    }
  }

  let response: NextResponse;
  if (!signedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(login);
  } else if (signedIn && GUEST_ONLY.some((p) => matches(pathname, p))) {
    const target = safeNext(request.nextUrl.searchParams.get('next'));
    response = NextResponse.redirect(new URL(target, request.url));
  } else {
    for (const line of setCookies) {
      const [name, value] = parseSetCookie(line);
      if (value) request.cookies.set(name, value);
      else request.cookies.delete(name);
    }
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  for (const line of setCookies) response.headers.append('Set-Cookie', line);
  return response;
}

export const config = {
  // Pages only: not the /api rewrite, Next internals or static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

function isFresh(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const { exp } = decodeJwt(token);
    return typeof exp === 'number' && exp * 1000 > Date.now() + EXPIRY_SKEW_MS;
  } catch {
    return false;
  }
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function parseSetCookie(line: string): [name: string, value: string] {
  const [pair = ''] = line.split(';');
  const index = pair.indexOf('=');
  return [
    pair.slice(0, index).trim(),
    decodeURIComponent(pair.slice(index + 1)),
  ];
}
