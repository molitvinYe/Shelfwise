import { describe, expect, it } from 'vitest';
import { BookSearchQuery } from './books.js';

describe('BookSearchQuery', () => {
  it('coerces query-string values and treats blanks as unset', () => {
    expect(
      BookSearchQuery.parse({
        q: ' dune ',
        subject: '',
        yearFrom: '1960',
        limit: '5',
        language: 'ENG',
      }),
    ).toEqual({ q: 'dune', yearFrom: 1960, limit: 5, language: 'eng' });
  });

  it('defaults the page size', () => {
    expect(BookSearchQuery.parse({}).limit).toBe(20);
  });

  it('rejects an inverted year range and relevance without a query', () => {
    expect(
      BookSearchQuery.safeParse({ yearFrom: '2000', yearTo: '1990' }).success,
    ).toBe(false);
    expect(BookSearchQuery.safeParse({ sort: 'relevance' }).success).toBe(
      false,
    );
    expect(
      BookSearchQuery.safeParse({ sort: 'relevance', q: 'x' }).success,
    ).toBe(true);
  });

  it('rejects bad language codes, sorts and oversized limits', () => {
    expect(BookSearchQuery.safeParse({ language: 'english' }).success).toBe(
      false,
    );
    expect(BookSearchQuery.safeParse({ sort: 'random' }).success).toBe(false);
    expect(BookSearchQuery.safeParse({ limit: '51' }).success).toBe(false);
  });
});
