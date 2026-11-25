import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps same-origin paths with query strings and hashes', () => {
    expect(safeNext('/me')).toBe('/me');
    expect(safeNext('/books?q=dune')).toBe('/books?q=dune');
    expect(safeNext('/books#top')).toBe('/books#top');
  });

  it.each([
    null,
    undefined,
    '',
    'me',
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/\u0000/evil.com',
  ])('falls back for %j', (value) => {
    expect(safeNext(value)).toBe('/');
  });

  it('keeps encoded characters as a path, not a host', () => {
    // `%09` stays percent-encoded in the path, so it can't turn into `//evil.com`.
    expect(safeNext('/%09/evil.com')).toBe('/%09/evil.com');
  });

  it('uses the given fallback', () => {
    expect(safeNext('//evil.com', '/me')).toBe('/me');
  });
});
