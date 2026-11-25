import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type BookDetail,
  BookIdParam,
  type BookListItem,
  type BookPage,
  type BookSearchQuery,
  type PageQuery,
  type ReviewPage,
  type SubjectList,
} from '@shelfwise/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  buildBookSearchSql,
  cursorKey,
  effectiveSort,
} from './book-search.query.js';

type SearchRow = BookListItem & { sortKey: unknown };

const REVIEWS_SORT = 'reviews';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalog search; also used by the AI advisor's `searchCatalog` tool (step 15). */
  async search(query: BookSearchQuery): Promise<BookPage> {
    const sort = effectiveSort(query);
    const cursor = query.cursor ? decodeCursor(query.cursor, sort) : undefined;
    const rows = await this.prisma.$queryRaw<SearchRow[]>(
      buildBookSearchSql(query, cursor),
    );

    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(({ sortKey: _sortKey, ...book }) => book),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ s: sort, k: cursorKey(last.sortKey), id: last.id })
          : null,
    };
  }

  /** Subjects with book counts, most common first (filter UI). */
  async subjects(): Promise<SubjectList> {
    const rows = await this.prisma.$queryRaw<
      { subject: string; count: number }[]
    >`
      SELECT s AS "subject", count(*)::int AS "count"
      FROM "Book", unnest("subjects") AS s
      GROUP BY s
      ORDER BY "count" DESC, s ASC
    `;
    return { items: rows };
  }

  async findById(id: string): Promise<BookDetail> {
    // A malformed id can't exist: 404, like any unknown book.
    const book = BookIdParam.safeParse(id).success
      ? await this.prisma.book.findUnique({
          where: { id },
          omit: { createdAt: true },
        })
      : null;
    if (!book) throw notFound();

    const rating = await this.prisma.userBook.aggregate({
      where: { bookId: id, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const avg = rating._avg.rating;
    return {
      ...book,
      ratingAverage: avg === null ? null : Math.round(avg * 10) / 10,
      ratingCount: rating._count.rating,
    };
  }

  /** Visible reviews, newest first. Keyset on `(updatedAt, userId)` — one review per user and book. */
  async reviews(
    bookId: string,
    { limit, cursor }: PageQuery,
  ): Promise<ReviewPage> {
    const exists =
      BookIdParam.safeParse(bookId).success &&
      (await this.prisma.book.count({ where: { id: bookId } })) > 0;
    if (!exists) throw notFound();

    const after = cursor ? decodeCursor(cursor, REVIEWS_SORT) : undefined;
    const afterDate =
      after && typeof after.k === 'string' ? new Date(after.k) : undefined;
    if (after && (!afterDate || Number.isNaN(afterDate.getTime()))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Invalid cursor',
      );
    }

    const rows = await this.prisma.userBook.findMany({
      where: {
        bookId,
        review: { not: null },
        isReviewHidden: false,
        ...(after && afterDate
          ? {
              OR: [
                { updatedAt: { lt: afterDate } },
                { updatedAt: afterDate, userId: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { userId: 'desc' }],
      take: limit + 1,
      select: {
        userId: true,
        rating: true,
        review: true,
        updatedAt: true,
        user: { select: { id: true, displayName: true } },
      },
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => ({
        user: r.user,
        rating: r.rating,
        review: r.review ?? '',
        updatedAt: r.updatedAt.toISOString(),
      })),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              s: REVIEWS_SORT,
              k: last.updatedAt.toISOString(),
              id: last.userId,
            })
          : null,
    };
  }
}

function notFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Book not found');
}
