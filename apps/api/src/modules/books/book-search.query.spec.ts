import { BookSearchQuery } from '@shelfwise/shared';
import { Prisma } from '../../generated/prisma/client.js';
import {
  buildBookSearchSql,
  cursorKey,
  effectiveSort,
} from './book-search.query.js';

const parse = (input: Record<string, string>) => BookSearchQuery.parse(input);
const id = '0190a0c0-0000-7000-8000-000000000001';
const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('effectiveSort', () => {
  it('defaults to relevance with a query, title without', () => {
    expect(effectiveSort({ q: 'dune' })).toBe('relevance');
    expect(effectiveSort({})).toBe('title');
    expect(effectiveSort({ q: 'dune', sort: 'year_desc' })).toBe('year_desc');
  });
});

describe('buildBookSearchSql', () => {
  it('without filters: no WHERE, title order, limit + 1', () => {
    const { text: sql, values } = buildBookSearchSql(
      parse({ limit: '10' }),
      undefined,
    );
    expect(flat(sql)).not.toContain('WHERE');
    expect(flat(sql)).toContain('ORDER BY "sortKey" ASC, "id" ASC');
    expect(values).toEqual([11]);
  });

  it('binds every filter as a parameter and combines them with AND', () => {
    const { text: sql, values } = buildBookSearchSql(
      parse({
        q: "dune'; drop table",
        subject: 'Fantasy',
        yearFrom: '1960',
        yearTo: '1970',
        language: 'eng',
      }),
      undefined,
    );
    const text = flat(sql);
    expect(text).toContain('"searchVector" @@ websearch_to_tsquery');
    expect(text).toContain('"subjects" @> ARRAY[');
    expect(text).toContain('"year" >= $');
    expect(text).toContain('"year" <= $');
    expect(text).toContain('"language" = $');
    expect(text.match(/ AND /g)).toHaveLength(4);
    expect(text).not.toContain('drop table');
    expect(values).toEqual(
      expect.arrayContaining([
        "dune'; drop table",
        'fantasy',
        1960,
        1970,
        'eng',
      ]),
    );
  });

  it.each([
    ['relevance', { q: 'dune' }, '<', 'DESC', 'numeric'],
    ['title', {}, '>', 'ASC', 'text'],
    ['year_desc', { sort: 'year_desc' }, '<', 'DESC', 'int'],
    ['year_asc', { sort: 'year_asc' }, '>', 'ASC', 'int'],
    ['newest', { sort: 'newest' }, '<', 'DESC', 'timestamptz'],
  ])(
    '%s: keyset condition follows the sort direction',
    (sort, input, op, dir, cast) => {
      const { text: sql, values } = buildBookSearchSql(parse(input), {
        s: sort,
        k: 'key',
        id,
      });
      const text = flat(sql);
      expect(text).toContain(`("sortKey", "id") ${op} (CAST($`);
      expect(text).toContain(`AS ${cast}), CAST($`);
      expect(text).toContain(`ORDER BY "sortKey" ${dir}, "id" ${dir}`);
      expect(values).toEqual(expect.arrayContaining(['key', id]));
    },
  );

  it('refuses relevance without a query', () => {
    expect(() =>
      buildBookSearchSql({ limit: 20, sort: 'relevance' }, undefined),
    ).toThrow('needs a search query');
  });
});

describe('cursorKey', () => {
  it('normalises Postgres values', () => {
    expect(cursorKey(new Date('2026-11-25T10:00:00.123Z'))).toBe(
      '2026-11-25T10:00:00.123Z',
    );
    expect(cursorKey('1.400000')).toBe('1.400000');
    expect(cursorKey(1965)).toBe(1965);
    expect(cursorKey(new Prisma.Decimal('0.5'))).toBe('0.5');
    expect(() => cursorKey({})).toThrow('Unexpected sort key');
  });
});
