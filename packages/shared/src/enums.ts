import { z } from 'zod';

/** User role. Mirrors the Prisma `Role` enum. */
export const Role = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof Role>;

/** Catalog sort orders for `GET /books`. `relevance` requires a search query. */
export const BookSort = z.enum([
  'relevance',
  'title',
  'year_desc',
  'year_asc',
  'newest',
]);
export type BookSort = z.infer<typeof BookSort>;

/** Shelf a book is on. Mirrors the Prisma `ShelfStatus` enum. */
export const ShelfStatus = z.enum(['WANT', 'READING', 'READ']);
export type ShelfStatus = z.infer<typeof ShelfStatus>;
