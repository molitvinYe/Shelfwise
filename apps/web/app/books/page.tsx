import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  BookCard,
  BookGridSkeleton,
  bookGridClasses,
} from '@/components/catalog/book-card';
import {
  CatalogFiltersForm,
  CatalogFiltersSkeleton,
} from '@/components/catalog/catalog-filters';
import { LoadMoreBooks } from '@/components/catalog/load-more-books';
import { FormAlert } from '@/components/ui/form-alert';
import { getSubjects, searchBooks } from '@/lib/api/catalog';
import { parseCatalogParams } from '@/lib/catalog/search-params';

export const metadata: Metadata = {
  title: 'Catalog',
  description: 'Search thousands of books by title, author, subject and year.',
  alternates: { canonical: '/books' },
};

export default function CatalogPage(props: PageProps<'/books'>) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted">
          Popular books from Open Library — search by title, author or keyword.
        </p>
      </header>
      {/* searchParams are request-time data: the header above is the static shell. */}
      <Suspense
        fallback={
          <>
            <CatalogFiltersSkeleton />
            <BookGridSkeleton />
          </>
        }
      >
        <Catalog searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Catalog({
  searchParams,
}: Pick<PageProps<'/books'>, 'searchParams'>) {
  const params = parseCatalogParams(await searchParams);
  const subjects = await getSubjects();

  if (!params.ok) {
    return (
      <>
        <CatalogFiltersForm
          filters={params.filters}
          subjects={subjects.items}
        />
        <FormAlert
          message={`Can’t search with these filters: ${params.message}.`}
        />
      </>
    );
  }

  const page = await searchBooks(params.apiQuery);
  const searching = Object.values(params.filters).some(Boolean);

  return (
    <>
      <CatalogFiltersForm filters={params.filters} subjects={subjects.items} />
      <section
        aria-labelledby="results-heading"
        className="flex flex-col gap-6"
      >
        <h2 id="results-heading" className="sr-only">
          {searching ? 'Search results' : 'All books'}
        </h2>
        {page.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-medium">
              No books match{params.filters.q && <> “{params.filters.q}”</>}.
            </p>
            <p className="mt-1 text-sm text-muted">
              Try fewer filters or another spelling.{' '}
              <Link
                href="/books"
                className="text-accent underline-offset-4 hover:underline"
              >
                Browse all books
              </Link>
            </p>
          </div>
        ) : (
          <>
            <ul className={bookGridClasses}>
              {page.items.map((book, i) => (
                <BookCard key={book.id} book={book} priority={i < 6} />
              ))}
            </ul>
            {page.nextCursor && (
              <LoadMoreBooks
                key={params.apiQuery}
                apiQuery={params.apiQuery}
                initialCursor={page.nextCursor}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}
