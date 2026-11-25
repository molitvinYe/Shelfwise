import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestPrisma, resetDatabase } from './db.js';

/** Verifies the parts of the schema that live in hand-written SQL (trigger, CHECK constraints). */
describe('Database schema (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  async function search(query: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ title: string }[]>`
      SELECT "title"
      FROM "Book", websearch_to_tsquery('english', ${query}) AS q
      WHERE "searchVector" @@ q
      ORDER BY ts_rank_cd("searchVector", q) DESC, "id"
    `;
    return rows.map((r) => r.title);
  }

  it('fills searchVector on insert and ranks title matches above description matches', async () => {
    await prisma.book.createMany({
      data: [
        {
          olKey: '/works/OL1W',
          title: 'Children of Dune',
          authors: ['Frank Herbert'],
          subjects: ['science fiction'],
        },
        {
          olKey: '/works/OL2W',
          title: 'Desert Notes',
          authors: ['Barry Lopez'],
          description: 'Essays on dunes and empty landscapes.',
          subjects: ['nature'],
        },
        {
          olKey: '/works/OL3W',
          title: 'Emma',
          authors: ['Jane Austen'],
          subjects: ['romance'],
        },
      ],
    });

    expect(await search('dune')).toEqual(['Children of Dune', 'Desert Notes']);
    expect(await search('herbert')).toEqual(['Children of Dune']);
    expect(await search('romance')).toEqual(['Emma']);
  });

  it('refreshes searchVector when searchable fields change', async () => {
    const book = await prisma.book.create({
      data: { olKey: '/works/OL4W', title: 'Untitled draft', authors: [] },
    });

    await prisma.book.update({
      where: { id: book.id },
      data: { title: 'The Left Hand of Darkness' },
    });

    expect(await search('darkness')).toEqual(['The Left Hand of Darkness']);
    expect(await search('untitled')).toEqual([]);
  });

  it('rejects ratings outside 1–5', async () => {
    const user = await prisma.user.create({
      data: { email: 'reader@example.com', displayName: 'Reader' },
    });
    const book = await prisma.book.create({
      data: { olKey: '/works/OL5W', title: 'Emma', authors: ['Jane Austen'] },
    });

    await expect(
      prisma.userBook.create({
        data: { userId: user.id, bookId: book.id, status: 'READ', rating: 6 },
      }),
    ).rejects.toThrow(/UserBook_rating_check/);

    await expect(
      prisma.userBook.create({
        data: { userId: user.id, bookId: book.id, status: 'READ', rating: 5 },
      }),
    ).resolves.toMatchObject({ rating: 5 });
  });

  it('cascades user deletion to their shelf and collections', async () => {
    const user = await prisma.user.create({
      data: { email: 'gone@example.com', displayName: 'Gone' },
    });
    const book = await prisma.book.create({
      data: { olKey: '/works/OL6W', title: 'Emma', authors: [] },
    });
    await prisma.userBook.create({
      data: { userId: user.id, bookId: book.id, status: 'WANT' },
    });
    await prisma.collection.create({
      data: {
        ownerId: user.id,
        title: 'Favourites',
        slug: 'favourites-abc123',
        books: { create: { bookId: book.id, position: 0 } },
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.userBook.count()).toBe(0);
    expect(await prisma.collection.count()).toBe(0);
    expect(await prisma.collectionBook.count()).toBe(0);
    expect(await prisma.book.count()).toBe(1);
  });
});
