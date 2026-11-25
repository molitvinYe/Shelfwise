import type { BookSort, SubjectCount } from '@shelfwise/shared';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import type { CatalogFilters } from '@/lib/catalog/search-params';

const SORT_LABELS: Record<BookSort, string> = {
  relevance: 'Relevance',
  title: 'Title A–Z',
  year_desc: 'Newest published',
  year_asc: 'Oldest published',
  newest: 'Recently added',
};

const fieldClasses =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 sm:text-sm';

/**
 * A plain GET form: filtering works without JavaScript, every result page has a shareable URL,
 * and the browser's back button walks through previous searches.
 */
export function CatalogFiltersForm({
  filters,
  subjects,
}: {
  filters: CatalogFilters;
  subjects: SubjectCount[];
}) {
  const hasFilters = Object.values(filters).some(Boolean);
  // Relevance only makes sense with a query; offering it otherwise would produce a 400.
  const sorts = (Object.keys(SORT_LABELS) as BookSort[]).filter(
    (s) => s !== 'relevance' || filters.q,
  );

  return (
    <form
      action="/books"
      method="get"
      role="search"
      aria-label="Search the catalog"
      className="flex flex-col gap-3"
    >
      <div className="flex gap-2">
        <label htmlFor="catalog-q" className="sr-only">
          Title, author or keyword
        </label>
        <input
          id="catalog-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Title, author or keyword"
          maxLength={200}
          className={fieldClasses}
        />
        <button type="submit" className={buttonClasses('primary')}>
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <label
            htmlFor="catalog-subject"
            className="text-xs font-medium text-muted"
          >
            Subject
          </label>
          <select
            id="catalog-subject"
            name="subject"
            defaultValue={filters.subject ?? ''}
            className={fieldClasses}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject} ({s.count})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="catalog-from"
            className="text-xs font-medium text-muted"
          >
            Published from
          </label>
          <input
            id="catalog-from"
            type="number"
            name="yearFrom"
            inputMode="numeric"
            min={0}
            max={2100}
            placeholder="Any"
            defaultValue={filters.yearFrom}
            className={fieldClasses}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="catalog-to"
            className="text-xs font-medium text-muted"
          >
            Published to
          </label>
          <input
            id="catalog-to"
            type="number"
            name="yearTo"
            inputMode="numeric"
            min={0}
            max={2100}
            placeholder="Any"
            defaultValue={filters.yearTo}
            className={fieldClasses}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <label
            htmlFor="catalog-sort"
            className="text-xs font-medium text-muted"
          >
            Sort by
          </label>
          <select
            id="catalog-sort"
            name="sort"
            defaultValue={filters.sort ?? ''}
            className={fieldClasses}
          >
            <option value="">
              {filters.q ? 'Relevance' : 'Title A–Z'} (default)
            </option>
            {sorts.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className={buttonClasses('secondary')}>
          Apply filters
        </button>
        {hasFilters && (
          <Link
            href="/books"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Clear all
          </Link>
        )}
      </div>
    </form>
  );
}

export function CatalogFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-10 w-full animate-pulse rounded-lg bg-border/50" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-border/40" />
        ))}
      </div>
    </div>
  );
}
