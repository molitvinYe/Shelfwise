import { CATEGORIES } from './categories.js';
import {
  DESCRIPTION_MAX,
  extractDescription,
  mapSearchDoc,
  pickLanguage,
  type SearchDoc,
  toCategories,
} from './open-library.mapper.js';

const fantasy = CATEGORIES.find((c) => c.label === 'fantasy');

const doc = (overrides: Partial<SearchDoc> = {}): SearchDoc => ({
  key: '/works/OL82563W',
  title: 'Harry Potter à l’école des sorciers',
  author_name: ['J. K. Rowling', 'J. K. Rowling'],
  first_publish_year: 1997,
  subject: ['Fantasy', 'Magic'],
  language: ['fre', 'eng'],
  cover_i: 15155833,
  editions: {
    docs: [
      { title: "Harry Potter and the Philosopher's Stone", language: ['eng'] },
    ],
  },
  ...overrides,
});

describe('mapSearchDoc', () => {
  it('prefers the English edition title, dedupes authors, tags the fetched category', () => {
    expect(mapSearchDoc(doc(), fantasy)).toEqual({
      olKey: '/works/OL82563W',
      title: "Harry Potter and the Philosopher's Stone",
      authors: ['J. K. Rowling'],
      year: 1997,
      subjects: ['fantasy'],
      language: 'eng',
      coverId: 15155833,
    });
  });

  it('falls back to the work title without an English edition', () => {
    expect(
      mapSearchDoc(
        doc({ editions: { docs: [{ title: 'X', language: ['fre'] }] } }),
      )?.title,
    ).toBe('Harry Potter à l’école des sorciers');
  });

  it.each<[string, Partial<SearchDoc>]>([
    ['no cover', { cover_i: undefined }],
    ['no authors', { author_name: [] }],
    ['no year', { first_publish_year: undefined }],
    ['no title', { title: '  ', editions: undefined }],
    ['bad key', { key: '/books/OL1M' }],
    ['future year', { first_publish_year: 3000 }],
  ])('drops entries with %s', (_name, overrides) => {
    expect(mapSearchDoc(doc(overrides))).toBeNull();
  });
});

describe('toCategories', () => {
  it('uses only the fetched category when given', () => {
    expect(toCategories(['Romance', 'History'], fantasy)).toEqual(['fantasy']);
  });

  it('matches aliases case-insensitively otherwise', () => {
    expect(
      toCategories(['Science Fiction', 'love stories', 'nyt:whatever']),
    ).toEqual(['romance', 'science fiction']);
  });
});

describe('pickLanguage', () => {
  it('prefers English, else the first language, else null', () => {
    expect(pickLanguage(['ger', 'eng'])).toBe('eng');
    expect(pickLanguage(['ger', 'fre'])).toBe('ger');
    expect(pickLanguage(undefined)).toBeNull();
  });
});

describe('extractDescription', () => {
  it('accepts a plain string or a { value } object', () => {
    expect(extractDescription({ description: 'A boy wizard.' })).toBe(
      'A boy wizard.',
    );
    expect(
      extractDescription({ description: { value: 'A boy wizard.' } }),
    ).toBe('A boy wizard.');
    expect(extractDescription({})).toBeNull();
  });

  it('drops the source footer, markdown links and extra whitespace', () => {
    const raw =
      'A [classic](https://example.com)   novel.\n\nSecond line.\n\n----------\nAlso contained in:\n- [Box set](/works/OL1W)';
    expect(extractDescription({ description: raw })).toBe(
      'A classic novel. Second line.',
    );
  });

  it('truncates long descriptions at a word boundary', () => {
    const long = `${'word '.repeat(DESCRIPTION_MAX)}end`;
    const result = extractDescription({ description: long }) ?? '';
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX + 1);
    expect(result.endsWith('word…')).toBe(true);
  });
});

describe('CATEGORIES', () => {
  it('has unique labels and no alias claimed by two categories', () => {
    const labels = CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
    const aliases = CATEGORIES.flatMap((c) =>
      c.aliases.map((a) => a.toLowerCase()),
    );
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});
