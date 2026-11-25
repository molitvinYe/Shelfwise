import { describe, expect, it } from 'vitest';
import {
  CATALOG_PAGE_SIZE,
  catalogHref,
  parseCatalogParams,
} from './search-params';

describe('parseCatalogParams', () => {
  it('normalises filters into a stable API query, dropping blanks and cursor', () => {
    const result = parseCatalogParams({
      sort: 'year_desc',
      q: ' dune ',
      subject: ['Fantasy', 'horror'],
      yearTo: '',
      cursor: 'abc',
    });
    expect(result).toEqual({
      ok: true,
      filters: { q: 'dune', subject: 'fantasy', sort: 'year_desc' },
      apiQuery: `q=dune&subject=fantasy&sort=year_desc&limit=${CATALOG_PAGE_SIZE}`,
    });
  });

  it('returns a readable message for invalid filters', () => {
    const result = parseCatalogParams({ yearFrom: '2000', yearTo: '1990' });
    expect(result).toMatchObject({
      ok: false,
      message: 'yearFrom must not be greater than yearTo',
    });
  });
});

describe('catalogHref', () => {
  it('builds a link with only the set filters', () => {
    expect(catalogHref({ subject: 'science fiction' })).toBe(
      '/books?subject=science+fiction',
    );
    expect(catalogHref({})).toBe('/books');
  });
});
