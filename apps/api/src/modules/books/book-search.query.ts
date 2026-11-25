import { HttpStatus } from '@nestjs/common';
import type { BookSearchQuery, BookSort } from '@shelfwise/shared';
import { AppException } from '../../common/errors/app.exception.js';
import type { CursorPayload } from '../../common/pagination/cursor.js';
import { Prisma } from '../../generated/prisma/client.js';

/** Must match the text search config of the `book_search_vector_update` trigger. */
const TS_CONFIG = 'english';

/** Without an explicit sort: relevance when searching, otherwise alphabetical. */
export function effectiveSort(
  query: Pick<BookSearchQuery, 'q' | 'sort'>,
): BookSort {
  return query.sort ?? (query.q ? 'relevance' : 'title');
}

interface SortSpec {
  /** Sort key expression, selected as "sortKey". */
  key: (q: string | undefined) => Prisma.Sql;
  /** SQL cast for the cursor's key value. */
  cast: Prisma.Sql;
  desc: boolean;
}

const SORTS: Record<BookSort, SortSpec> = {
  // ts_rank_cd is a float4: rounded to a numeric so the cursor round-trips exactly. An exact title
  // match gets +1 so "dune" ranks "Dune" above "Dune Messiah" (same title weight otherwise).
  relevance: {
    key: (q) => Prisma.sql`round((
      ts_rank_cd("searchVector", websearch_to_tsquery(${TS_CONFIG}::regconfig, ${q ?? ''}))
      + CASE WHEN lower("title") = lower(${q ?? ''}) THEN 1 ELSE 0 END
    )::numeric, 6)`,
    cast: Prisma.sql`numeric`,
    desc: true,
  },
  title: {
    key: () => Prisma.sql`"title"`,
    cast: Prisma.sql`text`,
    desc: false,
  },
  // Imported books may have no year: they go last in both directions.
  year_desc: {
    key: () => Prisma.sql`COALESCE("year", -1)`,
    cast: Prisma.sql`int`,
    desc: true,
  },
  year_asc: {
    key: () => Prisma.sql`COALESCE("year", 9999)`,
    cast: Prisma.sql`int`,
    desc: false,
  },
  newest: {
    key: () => Prisma.sql`"createdAt"`,
    cast: Prisma.sql`timestamptz`,
    desc: true,
  },
};

/**
 * Builds the catalog search as one parameterised statement (all values bound, never inlined):
 * filters → sort key → keyset condition `(sortKey, id) </> (cursor)` → `LIMIT limit + 1`
 * (the extra row says whether there is a next page).
 */
export function buildBookSearchSql(
  query: BookSearchQuery,
  cursor: CursorPayload | undefined,
): Prisma.Sql {
  const sort = effectiveSort(query);
  if (sort === 'relevance' && !query.q) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Sorting by relevance needs a search query',
    );
  }
  const spec = SORTS[sort];

  const filters: Prisma.Sql[] = [];
  if (query.q) {
    filters.push(
      Prisma.sql`"searchVector" @@ websearch_to_tsquery(${TS_CONFIG}::regconfig, ${query.q})`,
    );
  }
  if (query.subject)
    filters.push(Prisma.sql`"subjects" @> ARRAY[${query.subject}]::text[]`);
  if (query.yearFrom !== undefined)
    filters.push(Prisma.sql`"year" >= ${query.yearFrom}`);
  if (query.yearTo !== undefined)
    filters.push(Prisma.sql`"year" <= ${query.yearTo}`);
  if (query.language) filters.push(Prisma.sql`"language" = ${query.language}`);

  const where = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
    : Prisma.empty;
  const op = spec.desc ? Prisma.raw('<') : Prisma.raw('>');
  const dir = spec.desc ? Prisma.raw('DESC') : Prisma.raw('ASC');
  const after = cursor
    ? Prisma.sql`WHERE ("sortKey", "id") ${op} (CAST(${cursor.k} AS ${spec.cast}), CAST(${cursor.id} AS uuid))`
    : Prisma.empty;

  return Prisma.sql`
    SELECT "id", "title", "authors", "year", "subjects", "coverId", "sortKey"
    FROM (
      SELECT "id", "title", "authors", "year", "subjects", "coverId", ${spec.key(query.q)} AS "sortKey"
      FROM "Book"
      ${where}
    ) AS b
    ${after}
    ORDER BY "sortKey" ${dir}, "id" ${dir}
    LIMIT ${query.limit + 1}
  `;
}

/** Cursor key for a row's `sortKey` as Postgres returns it (numeric → string, timestamptz → Date). */
export function cursorKey(sortKey: unknown): string | number | null {
  if (sortKey instanceof Date) return sortKey.toISOString();
  if (typeof sortKey === 'string' || typeof sortKey === 'number')
    return sortKey;
  if (sortKey === null) return null;
  if (sortKey instanceof Prisma.Decimal) return sortKey.toString();
  throw new Error(`Unexpected sort key type: ${typeof sortKey}`);
}
