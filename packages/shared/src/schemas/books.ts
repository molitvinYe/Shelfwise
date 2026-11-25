import { z } from 'zod';
import { BookSort } from '../enums.js';
import { PageQuery, pageOf } from './pagination.js';

export const SEARCH_QUERY_MAX = 200;
export const YEAR_MIN = 0;
export const YEAR_MAX = 2100;

/** Empty form fields (`?q=&subject=`) mean "not set". */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

const Year = z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX);

/** `GET /books` query. Without `sort`, relevance when searching, else title. */
export const BookSearchQuery = PageQuery.extend({
  q: optional(z.string().trim().max(SEARCH_QUERY_MAX)),
  subject: optional(z.string().trim().toLowerCase().max(60)),
  yearFrom: optional(Year),
  yearTo: optional(Year),
  language: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{3}$/, 'Use a 3-letter language code, e.g. "eng"'),
  ),
  sort: optional(BookSort),
})
  .refine(
    (q) =>
      q.yearFrom === undefined ||
      q.yearTo === undefined ||
      q.yearFrom <= q.yearTo,
    {
      message: 'yearFrom must not be greater than yearTo',
      path: ['yearFrom'],
    },
  )
  .refine((q) => q.sort !== 'relevance' || q.q !== undefined, {
    message: 'Sorting by relevance needs a search query',
    path: ['sort'],
  });
export type BookSearchQuery = z.infer<typeof BookSearchQuery>;

/** A book in lists and search results. */
export const BookListItem = z.object({
  id: z.uuid(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  subjects: z.array(z.string()),
  coverId: z.number().int().nullable(),
});
export type BookListItem = z.infer<typeof BookListItem>;

export const BookPage = pageOf(BookListItem);
export type BookPage = z.infer<typeof BookPage>;

/** `GET /books/:id`. The viewer's own shelf entry is added in roadmap step 10. */
export const BookDetail = BookListItem.extend({
  olKey: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  ratingAverage: z.number().nullable(),
  ratingCount: z.number().int(),
});
export type BookDetail = z.infer<typeof BookDetail>;

export const SubjectCount = z.object({
  subject: z.string(),
  count: z.number().int(),
});
export type SubjectCount = z.infer<typeof SubjectCount>;

/** `GET /books/subjects`, most common first. */
export const SubjectList = z.object({ items: z.array(SubjectCount) });
export type SubjectList = z.infer<typeof SubjectList>;

/** A visible review on a book page. */
export const ReviewItem = z.object({
  user: z.object({ id: z.uuid(), displayName: z.string() }),
  rating: z.number().int().min(1).max(5).nullable(),
  review: z.string(),
  updatedAt: z.iso.datetime(),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

export const ReviewPage = pageOf(ReviewItem);
export type ReviewPage = z.infer<typeof ReviewPage>;

/** `:id` route param. */
export const BookIdParam = z.uuid();

/** `GET /books/external-search?q=` — searching Open Library for books missing from the catalog. */
export const ExternalSearchQuery = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Type at least 2 characters')
    .max(SEARCH_QUERY_MAX),
});
export type ExternalSearchQuery = z.infer<typeof ExternalSearchQuery>;

export const OL_WORK_KEY = /^\/works\/OL\d+W$/;

/** An Open Library work; `bookId` is set when it is already in our catalog. */
export const ExternalBook = z.object({
  olKey: z.string().regex(OL_WORK_KEY),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int().nullable(),
  coverId: z.number().int().nullable(),
  bookId: z.uuid().nullable(),
});
export type ExternalBook = z.infer<typeof ExternalBook>;

export const ExternalSearchResult = z.object({ items: z.array(ExternalBook) });
export type ExternalSearchResult = z.infer<typeof ExternalSearchResult>;

/** `POST /books/import`. */
export const ImportBookInput = z.object({
  olKey: z
    .string()
    .trim()
    .regex(
      OL_WORK_KEY,
      'Expected an Open Library work key like /works/OL45883W',
    ),
});
export type ImportBookInput = z.infer<typeof ImportBookInput>;
