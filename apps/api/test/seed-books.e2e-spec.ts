import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { SnapshotBook } from '../src/modules/books/open-library/open-library.mapper.js';
import { seedBooks } from '../src/seed/seed-books.js';
import { createTestPrisma, resetDatabase } from './db.js';

const book = (
  n: number,
  overrides: Partial<SnapshotBook> = {},
): SnapshotBook => ({
  olKey: `/works/OL${n}W`,
  title: `Book ${n}`,
  authors: ['Author'],
  description: null,
  year: 2000,
  subjects: ['fantasy'],
  language: 'eng',
  coverId: n,
  ...overrides,
});

describe('seedBooks (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('inserts missing books only and is idempotent', async () => {
    const books = [book(1), book(2), book(3)];
    expect(await seedBooks(prisma, books)).toEqual({
      inserted: 3,
      existing: 0,
    });
    expect(await seedBooks(prisma, books)).toEqual({
      inserted: 0,
      existing: 3,
    });
    expect(await prisma.book.count()).toBe(3);
  });

  it('never overwrites a book that is already present (e.g. imported on demand)', async () => {
    await prisma.book.create({ data: book(1, { title: 'Edited title' }) });
    await seedBooks(prisma, [book(1), book(2)]);
    const stored = await prisma.book.findUniqueOrThrow({
      where: { olKey: '/works/OL1W' },
    });
    expect(stored.title).toBe('Edited title');
  });

  it('makes seeded books searchable through the FTS trigger', async () => {
    await seedBooks(prisma, [
      book(10, {
        title: 'The Name of the Wind',
        description: 'A legendary magician.',
      }),
      book(11, { title: 'Dune', description: 'Desert planet politics.' }),
    ]);
    const hits = await prisma.$queryRaw<{ title: string }[]>`
      SELECT title FROM "Book"
      WHERE "searchVector" @@ websearch_to_tsquery('english', 'magicians')
    `;
    expect(hits.map((h) => h.title)).toEqual(['The Name of the Wind']);
  });
});
