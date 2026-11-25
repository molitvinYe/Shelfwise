import { z } from 'zod';
import { CURSOR_MAX, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../limits.js';

/** `?limit=&cursor=` — query-string values arrive as strings. */
export const PageQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).max(CURSOR_MAX).optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

/** `{ items, nextCursor }` for any item schema. */
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
