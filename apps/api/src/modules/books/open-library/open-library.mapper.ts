import { z } from 'zod';
import { CATEGORIES, type Category } from './categories.js';

export const DESCRIPTION_MAX = 2000;

/** A book ready to be inserted (the shape of the committed snapshot). */
export const SnapshotBook = z.object({
  olKey: z.string().regex(/^\/works\/OL\d+W$/),
  title: z.string().min(1),
  authors: z.array(z.string()).min(1),
  description: z.string().nullable(),
  year: z.number().int().min(0).max(2100).nullable(),
  subjects: z.array(z.string()),
  language: z.string().nullable(),
  coverId: z.number().int().positive().nullable(),
});
export type SnapshotBook = z.infer<typeof SnapshotBook>;

/** A `search.json` doc (only the fields we request). */
export const SearchDoc = z.object({
  key: z.string(),
  title: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().int().optional(),
  subject: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  cover_i: z.number().int().optional(),
  /** With `lang=en`, Open Library puts the best English edition first. */
  editions: z
    .object({
      docs: z.array(
        z.object({
          title: z.string().optional(),
          language: z.array(z.string()).optional(),
        }),
      ),
    })
    .optional(),
});
export type SearchDoc = z.infer<typeof SearchDoc>;

/** `/works/{id}.json`: the description is either a string or `{ type, value }`. */
export const WorkResponse = z.object({
  description: z
    .union([z.string(), z.object({ value: z.string() })])
    .optional(),
});
export type WorkResponse = z.infer<typeof WorkResponse>;

const aliasToLabel = new Map(
  CATEGORIES.flatMap((c) =>
    c.aliases.map((a) => [a.toLowerCase(), c.label] as const),
  ),
);

/**
 * Curated labels for a book. When it was fetched as a popular book of a category, that category
 * alone (merged across categories by the caller): alias matching on Open Library's tags is too
 * noisy for popular works ("1984" is tagged drama, war, short stories…). Without one (import on
 * demand), labels whose aliases match the tags.
 */
export function toCategories(
  tags: readonly string[],
  fetchedFor?: Category,
): string[] {
  if (fetchedFor) return [fetchedFor.label];
  const labels = new Set<string>();
  for (const tag of tags) {
    const label = aliasToLabel.get(tag.trim().toLowerCase());
    if (label) labels.add(label);
  }
  return [...labels].sort();
}

/** Prefers English when the work has an English edition, else the first listed language. */
export function pickLanguage(
  languages: readonly string[] | undefined,
): string | null {
  if (!languages?.length) return null;
  return languages.includes('eng') ? 'eng' : (languages[0] ?? null);
}

/**
 * Maps a search doc to a catalog book without a description (that needs `/works/{id}.json`).
 * Returns null for entries not worth showing: no title, no author, no cover or no year.
 */
export function mapSearchDoc(
  doc: SearchDoc,
  fetchedFor?: Category,
): Omit<SnapshotBook, 'description'> | null {
  const english = doc.editions?.docs[0];
  const title = (
    english?.language?.includes('eng') && english.title
      ? english.title
      : doc.title
  )?.trim();
  const authors = [
    ...new Set((doc.author_name ?? []).map((a) => a.trim()).filter(Boolean)),
  ];
  const year = doc.first_publish_year;
  if (!title || authors.length === 0 || !doc.cover_i || year === undefined)
    return null;
  if (!/^\/works\/OL\d+W$/.test(doc.key) || year < 0 || year > 2100)
    return null;

  return {
    olKey: doc.key,
    title,
    authors: authors.slice(0, 5),
    year,
    subjects: toCategories(doc.subject ?? [], fetchedFor),
    language: pickLanguage(doc.language),
    coverId: doc.cover_i,
  };
}

/**
 * Plain-text description: drops the "----------" source/footnote block Open Library appends,
 * turns markdown links into their text, collapses whitespace, truncates at a word boundary.
 */
export function extractDescription(work: WorkResponse): string | null {
  const raw =
    typeof work.description === 'string'
      ? work.description
      : work.description?.value;
  if (!raw) return null;

  const text = (raw.split(/\r?\n\s*-{3,}\s*\r?\n/)[0] ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\d+\]:\s*\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= DESCRIPTION_MAX) return text;

  const cut = text.slice(0, DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > DESCRIPTION_MAX * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
