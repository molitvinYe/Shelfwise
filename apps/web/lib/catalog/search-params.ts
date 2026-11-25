import { BookSearchQuery } from '@shelfwise/shared';

/** Fits the 2/3/4-column grid. */
export const CATALOG_PAGE_SIZE = 24;

type RawParams = Record<string, string | string[] | undefined>;

/** The filters the catalog URL can carry, in a stable order (stable cache keys and links). */
const FILTER_KEYS = [
  'q',
  'subject',
  'yearFrom',
  'yearTo',
  'language',
  'sort',
] as const;
export type CatalogFilters = Partial<
  Record<(typeof FILTER_KEYS)[number], string>
>;

export type ParsedCatalogParams =
  | {
      ok: true;
      /** The filters as they should appear in the form (normalised). */
      filters: CatalogFilters;
      /** Canonical query string for `GET /books` without `cursor`, including `limit`. */
      apiQuery: string;
    }
  | { ok: false; filters: CatalogFilters; message: string };

/**
 * Validates the catalog URL with the same shared schema the API uses, so invalid filters show
 * a friendly message instead of an API error. `cursor` is ignored: pages are loaded by the
 * client "Load more" button, the URL always shows the first page.
 */
export function parseCatalogParams(raw: RawParams): ParsedCatalogParams {
  const input: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) input[key] = first;
  }

  const parsed = BookSearchQuery.safeParse({
    ...input,
    limit: String(CATALOG_PAGE_SIZE),
  });
  if (!parsed.success) {
    return {
      ok: false,
      filters: input,
      message: parsed.error.issues[0]?.message ?? 'Invalid filters',
    };
  }

  const filters: CatalogFilters = {};
  const api = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = parsed.data[key];
    if (value === undefined) continue;
    filters[key] = String(value);
    api.set(key, String(value));
  }
  api.set('limit', String(CATALOG_PAGE_SIZE));
  return { ok: true, filters, apiQuery: api.toString() };
}

/** `/books?…` link with one filter changed (e.g. a subject chip on the book page). */
export function catalogHref(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/books?${query}` : '/books';
}
