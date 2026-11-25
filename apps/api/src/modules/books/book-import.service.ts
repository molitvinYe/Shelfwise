import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { BookDetail, ExternalSearchResult } from '@shelfwise/shared';
import { z } from 'zod';
import { AppException } from '../../common/errors/app.exception.js';
import { FixedWindowLimiter } from '../../common/rate-limit/fixed-window.limiter.js';
import { getEnv } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { BooksService } from './books.service.js';
import { OpenLibraryClient } from './open-library/open-library.client.js';
import {
  extractDescription,
  mapSearchDoc,
  SearchDoc,
  WorkResponse,
} from './open-library/open-library.mapper.js';

const FIELDS =
  'key,title,author_name,first_publish_year,subject,language,cover_i,editions,editions.title,editions.language';
const SearchResponse = z.object({ docs: z.array(SearchDoc) });
const EXTERNAL_RESULTS = 20;
const LENIENT = { requireCoverAndYear: false };

/**
 * Import on demand (docs/modules/books.md): search Open Library and copy a work into the catalog
 * with the same mapper as the snapshot. Authenticated and limited per user.
 */
@Injectable()
export class BookImportService {
  private readonly env = getEnv();
  private readonly searchLimiter = new FixedWindowLimiter(60_000);
  private readonly importLimiter = new FixedWindowLimiter(3_600_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly books: BooksService,
    private readonly openLibrary: OpenLibraryClient,
    @InjectPinoLogger(BookImportService.name)
    private readonly logger: PinoLogger,
  ) {}

  async externalSearch(
    user: AuthUser,
    q: string,
  ): Promise<ExternalSearchResult> {
    this.searchLimiter.consume(user.id, this.env.EXTERNAL_SEARCH_PER_MINUTE);
    const { docs } = await this.call(() =>
      this.openLibrary.getJson(
        `/search.json?${new URLSearchParams({ q, lang: 'en', limit: String(EXTERNAL_RESULTS), fields: FIELDS })}`,
        SearchResponse,
      ),
    );
    const works = docs.flatMap(
      (doc) => mapSearchDoc(doc, undefined, LENIENT) ?? [],
    );
    const existing = await this.prisma.book.findMany({
      where: { olKey: { in: works.map((w) => w.olKey) } },
      select: { id: true, olKey: true },
    });
    const idByKey = new Map(existing.map((b) => [b.olKey, b.id]));

    return {
      items: works.map((w) => ({
        olKey: w.olKey,
        title: w.title,
        authors: w.authors,
        year: w.year,
        coverId: w.coverId,
        bookId: idByKey.get(w.olKey) ?? null,
      })),
    };
  }

  /** Idempotent on `olKey`: an existing book is returned as is (`created: false`) without calling Open Library. */
  async import(
    user: AuthUser,
    olKey: string,
  ): Promise<{ book: BookDetail; created: boolean }> {
    const existing = await this.prisma.book.findUnique({
      where: { olKey },
      select: { id: true },
    });
    if (existing)
      return { book: await this.books.findById(existing.id), created: false };

    this.importLimiter.consume(
      user.id,
      user.isDemo ? this.env.IMPORT_PER_HOUR_DEMO : this.env.IMPORT_PER_HOUR,
    );

    const [search, work] = await this.call(() =>
      Promise.all([
        this.openLibrary.getJson(
          `/search.json?${new URLSearchParams({ q: `key:${olKey}`, lang: 'en', limit: '1', fields: FIELDS })}`,
          SearchResponse,
        ),
        this.openLibrary
          .getJson(`${olKey}.json`, WorkResponse)
          .catch((error: unknown) => {
            // A missing work shows up as an empty search result; anything else is an upstream failure.
            if (isNotFound(error)) return null;
            throw error;
          }),
      ]),
    );
    const doc = search.docs.find((d) => d.key === olKey);
    const mapped = doc ? mapSearchDoc(doc, undefined, LENIENT) : null;
    if (!mapped) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        'Open Library has no importable work with this key',
      );
    }

    try {
      const created = await this.prisma.book.create({
        data: {
          ...mapped,
          description: work ? extractDescription(work) : null,
        },
        select: { id: true },
      });
      this.logger.info(
        { olKey, userId: user.id },
        'Book imported from Open Library',
      );
      return { book: await this.books.findById(created.id), created: true };
    } catch (error) {
      // Two users importing the same work at once: the loser returns the winner's row.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const book = await this.prisma.book.findUniqueOrThrow({
          where: { olKey },
          select: { id: true },
        });
        return { book: await this.books.findById(book.id), created: false };
      }
      throw error;
    }
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn({ err: error }, 'Open Library request failed');
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        'UPSTREAM_UNAVAILABLE',
        'Open Library is not responding, please try again later',
      );
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  );
}
