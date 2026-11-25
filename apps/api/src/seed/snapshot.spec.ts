import { CATEGORIES } from '../modules/books/open-library/categories.js';
import { loadSnapshot } from './seed-books.js';

/** Guards the committed `data/books.snapshot.json` (regenerated with `pnpm data:fetch`). */
describe('committed catalog snapshot', () => {
  it('is valid, large enough, unique by olKey and uses only curated subjects', async () => {
    const books = await loadSnapshot();

    expect(books.length).toBeGreaterThanOrEqual(2000);
    expect(new Set(books.map((b) => b.olKey)).size).toBe(books.length);

    const labels = new Set(CATEGORIES.map((c) => c.label));
    for (const book of books) {
      for (const subject of book.subjects) expect(labels).toContain(subject);
    }
    for (const { description } of books) {
      expect(description ?? '').not.toMatch(/\*\*|<[a-z/]|\]\[\d/i); // markdown/HTML leftovers
    }
    const described = books.filter((b) => b.description).length;
    expect(described / books.length).toBeGreaterThan(0.6);
  });
});
