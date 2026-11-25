import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookCover, coverUrl } from '@/components/catalog/book-cover';
import { BookReviews } from '@/components/catalog/book-reviews';
import { getBook, getBookReviews } from '@/lib/api/catalog';
import { catalogHref } from '@/lib/catalog/search-params';

const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English',
  spa: 'Spanish',
  fre: 'French',
  ger: 'German',
  por: 'Portuguese',
  ita: 'Italian',
  rus: 'Russian',
  ukr: 'Ukrainian',
};

export async function generateMetadata({
  params,
}: PageProps<'/books/[id]'>): Promise<Metadata> {
  const book = await getBook((await params).id);
  if (!book) return { title: 'Book not found' };

  const byline = `${book.title} by ${book.authors.join(', ')}`;
  const description = book.description
    ? truncate(book.description, 200)
    : `${byline}${book.year ? ` (${book.year})` : ''} on Shelfwise.`;
  return {
    title: book.title,
    description,
    alternates: { canonical: `/books/${book.id}` },
    openGraph: {
      type: 'book',
      title: byline,
      description,
      authors: book.authors,
      images: book.coverId
        ? [{ url: coverUrl(book.coverId, 'L'), alt: '' }]
        : undefined,
    },
  };
}

export default function BookPage(props: PageProps<'/books/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <Link
        href="/books"
        className="w-fit text-sm text-muted hover:text-foreground"
      >
        ← Catalog
      </Link>
      <Suspense fallback={<BookSkeleton />}>
        <BookDetails params={props.params} />
      </Suspense>
    </main>
  );
}

async function BookDetails({
  params,
}: Pick<PageProps<'/books/[id]'>, 'params'>) {
  const { id } = await params;
  const [book, reviews] = await Promise.all([getBook(id), getBookReviews(id)]);
  if (!book) notFound();

  return (
    <>
      <article className="grid gap-8 sm:grid-cols-[minmax(0,240px)_1fr]">
        <div className="mx-auto w-48 sm:w-full">
          <BookCover
            coverId={book.coverId}
            title={book.title}
            size="L"
            priority
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {book.title}
            </h1>
            <p className="text-lg text-muted">{book.authors.join(', ')}</p>
          </header>

          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {book.year !== null && (
              <div>
                <dt className="text-muted">First published</dt>
                <dd className="font-medium">{book.year}</dd>
              </div>
            )}
            {book.language && (
              <div>
                <dt className="text-muted">Language</dt>
                <dd className="font-medium">
                  {LANGUAGE_NAMES[book.language] ?? book.language}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted">Rating</dt>
              <dd className="font-medium">
                {book.ratingAverage === null ? (
                  'No ratings yet'
                ) : (
                  <>
                    <span aria-hidden>★ </span>
                    {book.ratingAverage.toFixed(1)}
                    <span className="text-muted">
                      {' '}
                      / 5 · {book.ratingCount}{' '}
                      {book.ratingCount === 1 ? 'rating' : 'ratings'}
                    </span>
                  </>
                )}
              </dd>
            </div>
          </dl>

          {book.subjects.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Subjects">
              {book.subjects.map((subject) => (
                <li key={subject}>
                  <Link
                    href={catalogHref({ subject })}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {subject}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {book.description ? (
            <p className="max-w-prose whitespace-pre-line leading-relaxed text-pretty">
              {book.description}
            </p>
          ) : (
            <p className="text-sm text-muted">No description available.</p>
          )}

          <p className="text-xs text-muted">
            Source:{' '}
            <a
              href={`https://openlibrary.org${book.olKey}`}
              className="underline-offset-4 hover:underline"
              rel="noopener"
            >
              Open Library
            </a>
          </p>
        </div>
      </article>

      <BookReviews bookId={book.id} initial={reviews} />
    </>
  );
}

function BookSkeleton() {
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,240px)_1fr]" aria-hidden>
      <div className="mx-auto aspect-[2/3] w-48 animate-pulse rounded-lg bg-border/50 sm:w-full" />
      <div className="flex flex-col gap-3">
        <div className="h-9 w-3/4 animate-pulse rounded-lg bg-border/50" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-border/40" />
        <div className="mt-4 h-24 w-full animate-pulse rounded bg-border/30" />
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.7 ? cut.lastIndexOf(' ') : max).trimEnd()}…`;
}
