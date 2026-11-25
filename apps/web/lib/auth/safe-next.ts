const BASE = 'http://shelfwise.invalid';

/**
 * Post-login redirect target from `?next=`. Only same-origin paths are allowed, so the login
 * page can't be used as an open redirect. Parses the URL instead of checking prefixes: browsers
 * strip tabs/newlines and treat `\` as `/`, so `/\t/evil.com` or `/\evil.com` would become
 * `//evil.com`. Control characters and backslashes are rejected outright.
 */
export function safeNext(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value || !value.startsWith('/')) return fallback;
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
