import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  ApiErrorBody,
  BookDetail,
  BookPage,
  ExternalSearchResult,
} from '@shelfwise/shared';
import request from 'supertest';
import type { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  OpenLibraryClient,
  OpenLibraryError,
} from '../src/modules/books/open-library/open-library.client.js';
import { seedUsers } from '../src/seed/seed-users.js';
import { cookiesFrom } from './auth-helpers.js';
import { createTestPrisma, resetDatabase } from './db.js';

/** Open Library double: canned search docs and works, records every call. */
class FakeOpenLibrary {
  calls: string[] = [];
  failing = false;
  docs = [
    {
      key: '/works/OL1W',
      title: 'Le Nom du vent',
      author_name: ['Patrick Rothfuss'],
      first_publish_year: 2007,
      cover_i: 101,
      subject: ['Fantasy fiction', 'Magic'],
      language: ['fre', 'eng'],
      editions: {
        docs: [{ title: 'The Name of the Wind', language: ['eng'] }],
      },
    },
    { key: '/works/OL2W', title: 'Obscure Pamphlet', author_name: ['Nobody'] },
    { key: '/works/OL3W', title: 'No Author' },
    {
      key: '/works/OL4W',
      title: 'Already Here',
      author_name: ['Someone'],
      first_publish_year: 1990,
      cover_i: 4,
    },
  ];
  works: Record<string, unknown> = {
    '/works/OL1W': {
      description: {
        value:
          'A gifted young man grows up.\n\n----------\nSee also: [x](/works/OL9W)',
      },
    },
  };

  getJson<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
    this.calls.push(path);
    if (this.failing)
      return Promise.reject(new OpenLibraryError('Open Library 503', 503));
    if (path.startsWith('/search.json')) {
      const q = new URLSearchParams(path.split('?')[1]).get('q') ?? '';
      const docs = q.startsWith('key:')
        ? this.docs.filter((d) => d.key === q.slice(4))
        : this.docs;
      return Promise.resolve(schema.parse({ docs }));
    }
    const work = this.works[path.replace(/\.json$/, '')];
    return work
      ? Promise.resolve(schema.parse(work))
      : Promise.reject(new OpenLibraryError('Open Library 404', 404));
  }
}

describe('Books import (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const openLibrary = new FakeOpenLibrary();
  let userCookie: string;
  let alreadyHereId: string;

  const server = () => app.getHttpServer();

  async function register(email: string): Promise<string> {
    const res = await request(server())
      .post('/auth/register')
      .send({
        email,
        password: 'correct horse battery',
        displayName: 'Importer',
      })
      .expect(201);
    return `sw_access=${cookiesFrom(res).sw_access}`;
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await resetDatabase(prisma);
    await seedUsers(prisma, undefined);
    alreadyHereId = (
      await prisma.book.create({
        data: {
          olKey: '/works/OL4W',
          title: 'Already Here',
          authors: ['Someone'],
          subjects: [],
        },
      })
    ).id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenLibraryClient)
      .useValue(openLibrary)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    userCookie = await register('importer@example.com');
  });

  beforeEach(() => {
    openLibrary.calls = [];
    openLibrary.failing = false;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires a session for external search and import', async () => {
    await request(server()).get('/books/external-search?q=wind').expect(401);
    await request(server())
      .post('/books/import')
      .send({ olKey: '/works/OL1W' })
      .expect(401);
  });

  it('searches Open Library, keeps works without cover/year, marks books already imported', async () => {
    const res = await request(server())
      .get('/books/external-search?q=name of the wind')
      .set('Cookie', userCookie)
      .expect(200);
    expect(ExternalSearchResult.parse(res.body).items).toEqual([
      {
        olKey: '/works/OL1W',
        title: 'The Name of the Wind',
        authors: ['Patrick Rothfuss'],
        year: 2007,
        coverId: 101,
        bookId: null,
      },
      {
        olKey: '/works/OL2W',
        title: 'Obscure Pamphlet',
        authors: ['Nobody'],
        year: null,
        coverId: null,
        bookId: null,
      },
      {
        olKey: '/works/OL4W',
        title: 'Already Here',
        authors: ['Someone'],
        year: 1990,
        coverId: 4,
        bookId: alreadyHereId,
      },
    ]);
  });

  it('validates input', async () => {
    await request(server())
      .get('/books/external-search?q=a')
      .set('Cookie', userCookie)
      .expect(400);
    const res = await request(server())
      .post('/books/import')
      .set('Cookie', userCookie)
      .send({ olKey: '/books/OL1M' })
      .expect(400);
    expect(ApiErrorBody.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  it('imports a work (201), makes it searchable, and is idempotent (200, no upstream call)', async () => {
    const first = await request(server())
      .post('/books/import')
      .set('Cookie', userCookie)
      .send({ olKey: '/works/OL1W' })
      .expect(201);
    const book = BookDetail.parse(first.body);
    expect(book).toMatchObject({
      olKey: '/works/OL1W',
      title: 'The Name of the Wind',
      authors: ['Patrick Rothfuss'],
      description: 'A gifted young man grows up.',
      subjects: ['fantasy'],
      language: 'eng',
      coverId: 101,
      ratingCount: 0,
    });

    const search = await request(server()).get('/books?q=rothfuss').expect(200);
    expect(BookPage.parse(search.body).items.map((b) => b.id)).toEqual([
      book.id,
    ]);

    openLibrary.calls = [];
    const again = await request(server())
      .post('/books/import')
      .set('Cookie', userCookie)
      .send({ olKey: '/works/OL1W' })
      .expect(200);
    expect(BookDetail.parse(again.body).id).toBe(book.id);
    expect(openLibrary.calls).toEqual([]);
  });

  it('imports a work without a description', async () => {
    const res = await request(server())
      .post('/books/import')
      .set('Cookie', userCookie)
      .send({ olKey: '/works/OL2W' })
      .expect(201);
    expect(BookDetail.parse(res.body)).toMatchObject({
      description: null,
      year: null,
      coverId: null,
    });
  });

  it('404 when Open Library has no such work', async () => {
    const cookie = await register('notfound@example.com');
    const res = await request(server())
      .post('/books/import')
      .set('Cookie', cookie)
      .send({ olKey: '/works/OL999W' })
      .expect(404);
    expect(ApiErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('502 UPSTREAM_UNAVAILABLE when Open Library fails', async () => {
    openLibrary.failing = true;
    const cookie = await register('upstream@example.com');
    for (const req of [
      request(server())
        .get('/books/external-search?q=wind')
        .set('Cookie', cookie),
      request(server())
        .post('/books/import')
        .set('Cookie', cookie)
        .send({ olKey: '/works/OL5W' }),
    ]) {
      const res = await req.expect(502);
      expect(ApiErrorBody.parse(res.body).error.code).toBe(
        'UPSTREAM_UNAVAILABLE',
      );
    }
  });

  it('limits imports per user; the shared demo account gets a smaller budget', async () => {
    // IMPORT_PER_HOUR=3, IMPORT_PER_HOUR_DEMO=1 in vitest.config.e2e.ts
    const cookie = await register('limited@example.com');
    for (let i = 0; i < 3; i++) {
      await request(server())
        .post('/books/import')
        .set('Cookie', cookie)
        .send({ olKey: `/works/OL90${i}W` })
        .expect(404);
    }
    const limited = await request(server())
      .post('/books/import')
      .set('Cookie', cookie)
      .send({ olKey: '/works/OL910W' })
      .expect(429);
    expect(ApiErrorBody.parse(limited.body).error).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: expect.any(Number) },
    });
    // Re-importing an existing book doesn't count and still works.
    await request(server())
      .post('/books/import')
      .set('Cookie', cookie)
      .send({ olKey: '/works/OL4W' })
      .expect(200);

    const demo = await request(server()).post('/auth/demo').expect(200);
    const demoCookie = `sw_access=${cookiesFrom(demo).sw_access}`;
    await request(server())
      .post('/books/import')
      .set('Cookie', demoCookie)
      .send({ olKey: '/works/OL920W' })
      .expect(404);
    await request(server())
      .post('/books/import')
      .set('Cookie', demoCookie)
      .send({ olKey: '/works/OL921W' })
      .expect(429);
  });
});
