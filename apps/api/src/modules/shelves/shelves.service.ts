import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BookIdParam,
  type MyShelfEntry,
  type ShelfEntry,
  type ShelfListQuery,
  type ShelfPage,
  type UpdateShelfInput,
  type UpsertShelfInput,
} from '@shelfwise/shared';
import { AppException } from '../../common/errors/app.exception.js';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor.js';
import { Prisma, type UserBook } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const SHELF_SORT = 'shelf';

type EntryRow = Pick<
  UserBook,
  'bookId' | 'status' | 'rating' | 'review' | 'isReviewHidden' | 'updatedAt'
>;

const ENTRY_SELECT = {
  bookId: true,
  status: true,
  rating: true,
  review: true,
  isReviewHidden: true,
  updatedAt: true,
} as const;

export function toShelfEntry(row: EntryRow): ShelfEntry {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

/** Only fields present in the input are written: `undefined` = keep, `null` = clear. */
function changes(input: Partial<UpsertShelfInput>): Prisma.UserBookUpdateInput {
  return {
    ...(input.status !== undefined && { status: input.status }),
    ...(input.rating !== undefined && { rating: input.rating }),
    // Editing a review never clears `isReviewHidden`: a hidden review stays hidden until a
    // moderator unhides it, so editing can't be used to bypass moderation.
    ...(input.review !== undefined && { review: input.review }),
  };
}

/**
 * A user's shelves. Every query is scoped by the `userId` from the access token, so one user
 * can't read or change another user's rows by construction.
 */
@Injectable()
export class ShelvesService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntry(userId: string, bookId: string): Promise<MyShelfEntry> {
    if (!BookIdParam.safeParse(bookId).success) return { entry: null };
    const row = await this.prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: ENTRY_SELECT,
    });
    return { entry: row ? toShelfEntry(row) : null };
  }

  /** Idempotent upsert on `(userId, bookId)`. */
  async upsert(
    userId: string,
    bookId: string,
    input: UpsertShelfInput,
  ): Promise<ShelfEntry> {
    assertBookId(bookId);
    try {
      const row = await this.prisma.userBook.upsert({
        where: { userId_bookId: { userId, bookId } },
        create: {
          userId,
          bookId,
          status: input.status,
          rating: input.rating ?? null,
          review: input.review ?? null,
        },
        update: changes(input),
        select: ENTRY_SELECT,
      });
      return toShelfEntry(row);
    } catch (error) {
      // FK violation: the book doesn't exist.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw bookNotFound();
      }
      throw error;
    }
  }

  async update(
    userId: string,
    bookId: string,
    input: UpdateShelfInput,
  ): Promise<ShelfEntry> {
    assertBookId(bookId);
    try {
      const row = await this.prisma.userBook.update({
        where: { userId_bookId: { userId, bookId } },
        data: changes(input),
        select: ENTRY_SELECT,
      });
      return toShelfEntry(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AppException(
          HttpStatus.NOT_FOUND,
          'NOT_FOUND',
          'This book is not on your shelves',
        );
      }
      throw error;
    }
  }

  /** Idempotent: removing a book that isn't on a shelf is not an error. */
  async remove(userId: string, bookId: string): Promise<void> {
    if (!BookIdParam.safeParse(bookId).success) return;
    await this.prisma.userBook.deleteMany({ where: { userId, bookId } });
  }

  /** The user's shelves, most recently changed first. Keyset on `(updatedAt, bookId)`. */
  async listForUser(
    userId: string,
    { status, limit, cursor }: ShelfListQuery,
  ): Promise<ShelfPage> {
    const after = cursor ? decodeCursor(cursor, SHELF_SORT) : undefined;
    const afterDate =
      typeof after?.k === 'string' ? new Date(after.k) : undefined;
    if (after && (!afterDate || Number.isNaN(afterDate.getTime()))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'Invalid cursor',
      );
    }

    const rows = await this.prisma.userBook.findMany({
      where: {
        userId,
        ...(status && { status }),
        ...(after &&
          afterDate && {
            OR: [
              { updatedAt: { lt: afterDate } },
              { updatedAt: afterDate, bookId: { lt: after.id } },
            ],
          }),
      },
      orderBy: [{ updatedAt: 'desc' }, { bookId: 'desc' }],
      take: limit + 1,
      select: {
        ...ENTRY_SELECT,
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
            year: true,
            subjects: true,
            coverId: true,
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(({ book, ...row }) => ({ ...toShelfEntry(row), book })),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              s: SHELF_SORT,
              k: last.updatedAt.toISOString(),
              id: last.bookId,
            })
          : null,
    };
  }
}

function bookNotFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Book not found');
}

function assertBookId(bookId: string): void {
  if (!BookIdParam.safeParse(bookId).success) throw bookNotFound();
}
