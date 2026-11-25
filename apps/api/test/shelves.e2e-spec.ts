import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  ApiErrorBody,
  BookDetail,
  MyShelfEntry,
  ReviewPage,
  ShelfEntry,
  ShelfPage,
} from '@shelfwise/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { cookiesFrom } from './auth-helpers.js';
import { createTestPrisma, resetDatabase } from './db.js';

const MISSING = '0190a0c0-0000-7000-8000-000000000000';

describe('Shelves (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let alice: string;
  let bob: string;
  const books: string[] = [];

  const api = () => request(app.getHttpServer());

  async function register(email: string): Promise<string> {
    const res = await api()
      .post('/auth/register')
      .send({
        email,
        password: 'correct horse battery',
        displayName: email.split('@')[0],
      })
      .expect(201);
    return `sw_access=${cookiesFrom(res).sw_access}`;
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await resetDatabase(prisma);
    for (let n = 1; n <= 5; n++) {
      const book = await prisma.book.create({
        data: {
          olKey: `/works/OL${n}W`,
          title: `Book ${n}`,
          authors: ['Author'],
          subjects: [],
        },
      });
      books.push(book.id);
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    alice = await register('alice@example.com');
    bob = await register('bob@example.com');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const book = (i: number) => books[i] ?? '';

  it('requires a session', async () => {
    await api().get('/shelves/me').expect(401);
    await api()
      .put(`/shelves/${book(0)}`)
      .send({ status: 'WANT' })
      .expect(401);
  });

  it('PUT creates, then updates only the given fields (idempotent)', async () => {
    const created = ShelfEntry.parse(
      (
        await api()
          .put(`/shelves/${book(0)}`)
          .set('Cookie', alice)
          .send({ status: 'WANT' })
          .expect(200)
      ).body,
    );
    expect(created).toMatchObject({
      bookId: book(0),
      status: 'WANT',
      rating: null,
      review: null,
    });

    await api()
      .put(`/shelves/${book(0)}`)
      .set('Cookie', alice)
      .send({ status: 'READ', rating: 4, review: '  Loved it.  ' })
      .expect(200);
    const again = ShelfEntry.parse(
      (
        await api()
          .put(`/shelves/${book(0)}`)
          .set('Cookie', alice)
          .send({ status: 'READ' })
          .expect(200)
      ).body,
    );
    expect(again).toMatchObject({
      status: 'READ',
      rating: 4,
      review: 'Loved it.',
    });
    expect(await prisma.userBook.count()).toBe(1);
  });

  it('PATCH changes one field, clears with null / empty review, 404 when not shelved', async () => {
    const patched = ShelfEntry.parse(
      (
        await api()
          .patch(`/shelves/${book(0)}`)
          .set('Cookie', alice)
          .send({ rating: null, review: '' })
          .expect(200)
      ).body,
    );
    expect(patched).toMatchObject({
      status: 'READ',
      rating: null,
      review: null,
    });
    await api()
      .patch(`/shelves/${book(1)}`)
      .set('Cookie', alice)
      .send({ rating: 3 })
      .expect(404);
    await api()
      .patch(`/shelves/${book(0)}`)
      .set('Cookie', alice)
      .send({})
      .expect(400);
  });

  it('validates input and rejects unknown books', async () => {
    const bad = await api()
      .put(`/shelves/${book(0)}`)
      .set('Cookie', alice)
      .send({ status: 'READ', rating: 6 })
      .expect(400);
    expect(ApiErrorBody.parse(bad.body).error.details).toEqual([
      expect.objectContaining({ path: 'rating' }),
    ]);
    for (const id of [MISSING, 'not-a-uuid']) {
      const res = await api()
        .put(`/shelves/${id}`)
        .set('Cookie', alice)
        .send({ status: 'WANT' })
        .expect(404);
      expect(ApiErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
    }
  });

  it("users can't see or change each other's entries", async () => {
    await api()
      .put(`/shelves/${book(2)}`)
      .set('Cookie', bob)
      .send({ status: 'READING', rating: 2 })
      .expect(200);

    const aliceView = MyShelfEntry.parse(
      (
        await api()
          .get(`/shelves/me/books/${book(2)}`)
          .set('Cookie', alice)
          .expect(200)
      ).body,
    );
    expect(aliceView.entry).toBeNull();
    await api()
      .delete(`/shelves/${book(2)}`)
      .set('Cookie', alice)
      .expect(204);
    await api()
      .patch(`/shelves/${book(2)}`)
      .set('Cookie', alice)
      .send({ rating: 5 })
      .expect(404);

    const bobView = MyShelfEntry.parse(
      (
        await api()
          .get(`/shelves/me/books/${book(2)}`)
          .set('Cookie', bob)
          .expect(200)
      ).body,
    );
    expect(bobView.entry).toMatchObject({ status: 'READING', rating: 2 });
  });

  it('DELETE is idempotent', async () => {
    await api()
      .put(`/shelves/${book(3)}`)
      .set('Cookie', alice)
      .send({ status: 'WANT' })
      .expect(200);
    await api()
      .delete(`/shelves/${book(3)}`)
      .set('Cookie', alice)
      .expect(204);
    await api()
      .delete(`/shelves/${book(3)}`)
      .set('Cookie', alice)
      .expect(204);
    const view = MyShelfEntry.parse(
      (
        await api()
          .get(`/shelves/me/books/${book(3)}`)
          .set('Cookie', alice)
          .expect(200)
      ).body,
    );
    expect(view.entry).toBeNull();
  });

  it('lists my shelves newest first, filtered by status, paginated without duplicates', async () => {
    const carol = await register('carol@example.com');
    for (const [i, status] of [
      [0, 'READ'],
      [1, 'WANT'],
      [2, 'READ'],
      [3, 'READING'],
      [4, 'READ'],
    ] as const) {
      await api()
        .put(`/shelves/${book(i)}`)
        .set('Cookie', carol)
        .send({ status })
        .expect(200);
    }
    const all: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await api()
        .get(`/shelves/me?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
        .set('Cookie', carol)
        .expect(200);
      const page = ShelfPage.parse(res.body);
      all.push(...page.items.map((i) => i.book.title));
      cursor = page.nextCursor;
    } while (cursor);
    expect(all).toEqual(['Book 5', 'Book 4', 'Book 3', 'Book 2', 'Book 1']);

    const read = ShelfPage.parse(
      (
        await api()
          .get('/shelves/me?status=READ')
          .set('Cookie', carol)
          .expect(200)
      ).body,
    );
    expect(read.items.map((i) => i.book.title)).toEqual([
      'Book 5',
      'Book 3',
      'Book 1',
    ]);
  });

  it('a hidden review stays hidden after editing, is visible to its author and not public', async () => {
    const dave = await register('dave@example.com');
    await api()
      .put(`/shelves/${book(4)}`)
      .set('Cookie', dave)
      .send({ status: 'READ', rating: 1, review: 'spam spam' })
      .expect(200);
    await prisma.userBook.updateMany({
      where: { bookId: book(4), review: 'spam spam' },
      data: { isReviewHidden: true },
    });

    const edited = ShelfEntry.parse(
      (
        await api()
          .patch(`/shelves/${book(4)}`)
          .set('Cookie', dave)
          .send({ review: 'totally legit now' })
          .expect(200)
      ).body,
    );
    expect(edited).toMatchObject({
      review: 'totally legit now',
      isReviewHidden: true,
    });

    const reviews = ReviewPage.parse(
      (
        await api()
          .get(`/books/${book(4)}/reviews`)
          .expect(200)
      ).body,
    );
    expect(reviews.items.map((r) => r.review)).not.toContain(
      'totally legit now',
    );

    const detail = BookDetail.parse(
      (
        await api()
          .get(`/books/${book(4)}`)
          .expect(200)
      ).body,
    );
    expect(detail.ratingCount).toBeGreaterThanOrEqual(1);
  });
});
