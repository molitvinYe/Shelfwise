import { z } from 'zod';
import { ShelfStatus } from '../enums.js';
import { REVIEW_MAX } from '../limits.js';
import { BookListItem } from './books.js';
import { PageQuery, pageOf } from './pagination.js';

const Rating = z.number().int().min(1).max(5);

/** Trimmed; an empty review means "no review" (stored as null). */
const Review = z
  .string()
  .trim()
  .max(REVIEW_MAX, `Keep the review under ${REVIEW_MAX} characters`)
  .transform((s) => (s === '' ? null : s));

/**
 * `PUT /shelves/:bookId` — puts the book on a shelf, or changes it. Omitted fields keep their
 * current value (or start empty), so repeating the request is harmless (optimistic UI).
 */
export const UpsertShelfInput = z.object({
  status: ShelfStatus,
  rating: Rating.nullable().optional(),
  review: Review.nullable().optional(),
});
export type UpsertShelfInput = z.infer<typeof UpsertShelfInput>;

/** `PATCH /shelves/:bookId` — the book must already be on a shelf. */
export const UpdateShelfInput = UpsertShelfInput.partial().refine(
  (v) =>
    v.status !== undefined || v.rating !== undefined || v.review !== undefined,
  { message: 'Nothing to update' },
);
export type UpdateShelfInput = z.infer<typeof UpdateShelfInput>;

/** The viewer's own relationship with a book. */
export const ShelfEntry = z.object({
  bookId: z.uuid(),
  status: ShelfStatus,
  rating: Rating.nullable(),
  review: z.string().nullable(),
  /** Set by a moderator; the review stays visible to its author only. */
  isReviewHidden: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type ShelfEntry = z.infer<typeof ShelfEntry>;

/** `GET /shelves/me/books/:bookId` — `entry` is null when the book is on no shelf. */
export const MyShelfEntry = z.object({ entry: ShelfEntry.nullable() });
export type MyShelfEntry = z.infer<typeof MyShelfEntry>;

/** A shelf row with its book, for shelf lists. */
export const ShelfItem = ShelfEntry.extend({ book: BookListItem });
export type ShelfItem = z.infer<typeof ShelfItem>;

export const ShelfPage = pageOf(ShelfItem);
export type ShelfPage = z.infer<typeof ShelfPage>;

/** `GET /shelves/me?status=` */
export const ShelfListQuery = PageQuery.extend({
  status: z.preprocess(
    (v) => (v === '' ? undefined : v),
    ShelfStatus.optional(),
  ),
});
export type ShelfListQuery = z.infer<typeof ShelfListQuery>;
