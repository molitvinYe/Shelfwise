import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'sw_access';
export const REFRESH_COOKIE = 'sw_refresh';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * The browser only ever talks to the web origin, where the API lives under `/api` (docs/adr/0002),
 * so the refresh cookie is scoped to the browser-visible path of the auth routes.
 */
export const REFRESH_COOKIE_PATH = '/api/auth';

export function cookieOptions(
  secure: boolean,
  path: string,
  maxAgeSeconds: number,
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
): void {
  res.cookie(
    ACCESS_COOKIE,
    tokens.accessToken,
    cookieOptions(secure, '/', ACCESS_TTL_SECONDS),
  );
  res.cookie(
    REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions(secure, REFRESH_COOKIE_PATH, REFRESH_TTL_SECONDS),
  );
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  const { maxAge: _drop, ...access } = cookieOptions(secure, '/', 0);
  const { maxAge: _drop2, ...refresh } = cookieOptions(
    secure,
    REFRESH_COOKIE_PATH,
    0,
  );
  res.clearCookie(ACCESS_COOKIE, access);
  res.clearCookie(REFRESH_COOKIE, refresh);
}
