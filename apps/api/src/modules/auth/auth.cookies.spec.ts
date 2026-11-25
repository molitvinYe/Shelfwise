import { cookieOptions, REFRESH_COOKIE_PATH } from './auth.cookies.js';

describe('cookieOptions', () => {
  it('is httpOnly + SameSite=Lax and Secure only when asked', () => {
    expect(cookieOptions(true, '/', 60)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60_000,
    });
    expect(cookieOptions(false, '/', 60).secure).toBe(false);
  });

  it('scopes the refresh cookie to the browser-visible auth path', () => {
    expect(REFRESH_COOKIE_PATH).toBe('/api/auth');
  });
});
