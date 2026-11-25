import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  ApiErrorBody,
  BookDetail,
  BookPage,
  ReviewPage,
  SubjectList,
} from '@shelfwise/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestPrisma, resetDatabase } from './db.js';

/** ~20 books: a few hand-written ones for ranking/filters plus filler for pagination. */
interface Fixture {
  n: number;
  title: string;
  authors: string[];
  year: number | null;
  subjects: string[];
  description: string | null;
  language?: string;
}

const FIXTURES: Fixture[] = [
  {
    n: 1,
    title: 'Dune',
    authors: ['Frank Herbert'],
    year: 1965,
    subjects: ['science fiction'],
    description: 'Desert planet, spice and politics.',
  },
  {
    n: 2,
    title: 'Dune Messiah',
    authors: ['Frank Herbert'],
    year: 1969,
    subjects: ['science fiction'],
    description: 'Paul rules the empire.',
  },
  {
    n: 3,
    title: 'Sand and Sorrow',
    authors: ['A. Writer'],
    year: 2001,
    subjects: ['literary fiction'],
    description: 'A walk across a dune at dusk.',
  },
  {
    n: 4,
    title: 'The Hobbit',
    authors: ['J. R. R. Tolkien'],
    year: 1937,
    subjects: ['fantasy', 'children'],
    description: 'A dragon and a burglar.',
  },
  {
    n: 5,
    title: 'A Wizard of Earthsea',
    authors: ['Ursula K. Le Guin'],
    year: 1968,
    subjects: ['fantasy'],
    description: 'A young wizard and his shadow.',
    language: 'eng',
  },
  {
    n: 6,
    title: 'Der Zauberberg',
    authors: ['Thomas Mann'],
    year: 1924,
    subjects: ['classics'],
    description: 'A sanatorium in the Alps.',
    language: 'ger',
  },
  ...Array.from({ length: 16 }, (_, i) => ({
    n: 100 + i,
    title: `Filler ${String(i).padStart(2, '0')}`,
    authors: ['Filler Author'],
    year: i % 4 === 0 ? null : 1990 + (i % 5),
    subjects: ['fantasy'],
    description: null,
  })),
];

describe('Books (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const ids = new Map<string, string>();

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const titles = (body: unknown) =>
    BookPage.parse(body).items.map((b) => b.title);

  async function collect(query: string, limit = 5): Promise<string[]> {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await get(
        `/books?${query}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`,
      ).expect(200);
      const page = BookPage.parse(res.body);
      seen.push(...page.items.map((b) => b.id));
      cursor = page.nextCursor;
    } while (cursor);
    return seen;
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await resetDatabase(prisma);
    for (const { n, language, ...book } of FIXTURES) {
      const created = await prisma.book.create({
        data: {
          ...book,
          olKey: `/works/OL${n}W`,
          coverId: n,
          language: language ?? 'eng',
        },
      });
      ids.set(book.title, created.id);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /books', () => {
    it('ranks the exact title first, then title matches above description matches', async () => {
      const res = await get('/books?q=dune').expect(200);
      expect(titles(res.body)).toEqual([
        'Dune',
        'Dune Messiah',
        'Sand and Sorrow',
      ]);
    });

    it('matches authors and stems words', async () => {
      expect(titles((await get('/books?q=tolkien').expect(200)).body)).toEqual([
        'The Hobbit',
      ]);
      expect(titles((await get('/books?q=wizards').expect(200)).body)).toEqual([
        'A Wizard of Earthsea',
      ]);
    });

    it('combines filters', async () => {
      const res = await get(
        '/books?subject=fantasy&yearFrom=1930&yearTo=1970&language=eng&sort=year_asc',
      ).expect(200);
      expect(titles(res.body)).toEqual(['The Hobbit', 'A Wizard of Earthsea']);
      expect(
        titles((await get('/books?language=ger').expect(200)).body),
      ).toEqual(['Der Zauberberg']);
    });

    it('returns an empty page when nothing matches', async () => {
      expect((await get('/books?q=zzzzqqq').expect(200)).body).toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it.each(['title', 'year_desc', 'year_asc', 'newest'])(
      'paginates by %s without duplicates or gaps',
      async (sort) => {
        const all = await collect(`sort=${sort}`, 5);
        expect(all).toHaveLength(FIXTURES.length);
        expect(new Set(all).size).toBe(FIXTURES.length);
      },
    );

    it('puts books without a year last in both year orders', async () => {
      const desc = BookPage.parse(
        (await get('/books?sort=year_desc&limit=50').expect(200)).body,
      ).items;
      const asc = BookPage.parse(
        (await get('/books?sort=year_asc&limit=50').expect(200)).body,
      ).items;
      expect(desc.at(-1)?.year).toBeNull();
      expect(asc.at(-1)?.year).toBeNull();
      expect(asc[0]?.title).toBe('Der Zauberberg');
    });

    it('paginates relevance results', async () => {
      const all = await collect('q=fantasy%20OR%20dune', 2);
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBeGreaterThan(2);
    });

    it.each([
      ['relevance without q', 'sort=relevance', 'sort'],
      ['inverted years', 'yearFrom=2000&yearTo=1990', 'yearFrom'],
      ['bad cursor', 'cursor=nope', 'cursor'],
      ['limit too big', 'limit=51', 'limit'],
    ])('400 on %s', async (_name, query, path) => {
      const body = ApiErrorBody.parse(
        (await get(`/books?${query}`).expect(400)).body,
      );
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
    });

    it('rejects a cursor from another sort order', async () => {
      const { nextCursor } = BookPage.parse(
        (await get('/books?sort=title&limit=2').expect(200)).body,
      );
      await get(`/books?sort=newest&cursor=${nextCursor}`).expect(400);
    });
  });

  it('GET /books/subjects counts books per subject, most common first', async () => {
    const { items } = SubjectList.parse(
      (await get('/books/subjects').expect(200)).body,
    );
    expect(items[0]).toEqual({ subject: 'fantasy', count: 18 });
    expect(items).toContainEqual({ subject: 'science fiction', count: 2 });
  });

  describe('GET /books/:id and reviews', () => {
    let duneId: string;

    beforeAll(async () => {
      duneId = ids.get('Dune') ?? '';
      const users = await Promise.all(
        ['a', 'b', 'c', 'd'].map((x) =>
          prisma.user.create({
            data: { email: `${x}@example.com`, displayName: `Reader ${x}` },
          }),
        ),
      );
      const [a, b, c, d] = users;
      if (!a || !b || !c || !d) throw new Error('fixture users');
      const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 12, min));
      await prisma.userBook.createMany({
        data: [
          {
            userId: a.id,
            bookId: duneId,
            status: 'READ',
            rating: 5,
            review: 'A classic.',
            updatedAt: at(1),
          },
          {
            userId: b.id,
            bookId: duneId,
            status: 'READ',
            rating: 4,
            review: 'Dense but great.',
            updatedAt: at(2),
          },
          {
            userId: c.id,
            bookId: duneId,
            status: 'READ',
            rating: 1,
            review: 'spam',
            isReviewHidden: true,
            updatedAt: at(3),
          },
          {
            userId: d.id,
            bookId: duneId,
            status: 'READING',
            rating: null,
            review: null,
            updatedAt: at(4),
          },
        ],
      });
    });

    it('returns details with the rating summary (hidden reviews still count as ratings)', async () => {
      const book = BookDetail.parse(
        (await get(`/books/${duneId}`).expect(200)).body,
      );
      expect(book).toMatchObject({
        title: 'Dune',
        olKey: '/works/OL1W',
        description: 'Desert planet, spice and politics.',
        ratingAverage: 3.3,
        ratingCount: 3,
      });
    });

    it('a book without ratings has a null average', async () => {
      const book = BookDetail.parse(
        (await get(`/books/${ids.get('The Hobbit')}`).expect(200)).body,
      );
      expect(book).toMatchObject({ ratingAverage: null, ratingCount: 0 });
    });

    it('lists visible reviews newest first, paginated', async () => {
      const first = ReviewPage.parse(
        (await get(`/books/${duneId}/reviews?limit=1`).expect(200)).body,
      );
      expect(first.items.map((r) => r.review)).toEqual(['Dense but great.']);
      expect(first.items[0]?.user.displayName).toBe('Reader b');
      const second = ReviewPage.parse(
        (
          await get(
            `/books/${duneId}/reviews?limit=1&cursor=${first.nextCursor}`,
          ).expect(200)
        ).body,
      );
      expect(second).toEqual({
        items: [expect.objectContaining({ review: 'A classic.', rating: 5 })],
        nextCursor: null,
      });
    });

    it('404 for unknown or malformed ids', async () => {
      for (const path of [
        '/books/0190a0c0-0000-7000-8000-000000000000',
        '/books/not-a-uuid',
        '/books/not-a-uuid/reviews',
      ]) {
        expect(
          ApiErrorBody.parse((await get(path).expect(404)).body).error.code,
        ).toBe('NOT_FOUND');
      }
    });
  });
});
