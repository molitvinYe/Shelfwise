'use client';

import {
  BookDetail,
  type ExternalBook,
  ExternalSearchResult,
} from '@shelfwise/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { BookCover } from '@/components/catalog/book-cover';
import { Button, buttonClasses } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { ApiError, apiFetch, apiGet, errorMessage } from '@/lib/api/client';

function importErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'UPSTREAM_UNAVAILABLE') return error.message;
    if (error.code === 'RATE_LIMITED') {
      const seconds = (
        error.details as { retryAfterSeconds?: number } | undefined
      )?.retryAfterSeconds;
      return seconds
        ? `Import limit reached. Try again in about ${Math.ceil(seconds / 60)} min.`
        : errorMessage(error);
    }
  }
  return errorMessage(error);
}

export function ImportSearch({
  initialQuery,
  isDemo,
}: {
  initialQuery: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(
    initialQuery.trim().length >= 2 ? initialQuery.trim() : '',
  );

  const results = useQuery({
    queryKey: ['external-search', query],
    queryFn: ({ signal }) =>
      apiGet(
        `/books/external-search?q=${encodeURIComponent(query)}`,
        ExternalSearchResult,
        { signal },
      ),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const importBook = useMutation({
    mutationFn: (olKey: string) =>
      apiFetch('/books/import', BookDetail, {
        method: 'POST',
        json: { olKey },
      }),
    onSuccess: (book) => router.push(`/books/${book.id}`),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    if (next.length < 2) return;
    setQuery(next);
    importBook.reset();
    router.replace(`/books/import?q=${encodeURIComponent(next)}`, {
      scroll: false,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form role="search" onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="import-q" className="sr-only">
          Title or author on Open Library
        </label>
        <input
          id="import-q"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Title or author"
          minLength={2}
          maxLength={200}
          required
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 sm:text-sm"
        />
        <Button
          type="submit"
          pending={results.isFetching}
          pendingLabel="Searching…"
        >
          Search
        </Button>
      </form>

      {isDemo && (
        <p className="text-xs text-muted">
          The demo account is shared, so it can import only a few books per
          hour.
        </p>
      )}

      <FormAlert
        message={
          importBook.isError ? importErrorMessage(importBook.error) : null
        }
      />

      <section
        aria-labelledby="import-results"
        aria-busy={results.isFetching}
        className="flex flex-col gap-3"
      >
        <h2 id="import-results" className="sr-only">
          Open Library results
        </h2>
        {!query ? (
          <p className="text-sm text-muted">
            Search by title or author to see matching works.
          </p>
        ) : results.isPending ? (
          <ResultsSkeleton />
        ) : results.isError ? (
          <div className="flex flex-col items-start gap-3">
            <FormAlert message={importErrorMessage(results.error)} />
            <Button variant="secondary" onClick={() => results.refetch()}>
              Try again
            </Button>
          </div>
        ) : results.data.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Open Library has nothing for “{query}”. Check the spelling or try
            the author’s name.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {results.data.items.map((book) => (
              <ResultRow
                key={book.olKey}
                book={book}
                pending={
                  importBook.isPending && importBook.variables === book.olKey
                }
                disabled={importBook.isPending || importBook.isSuccess}
                onImport={() => importBook.mutate(book.olKey)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultRow({
  book,
  pending,
  disabled,
  onImport,
}: {
  book: ExternalBook;
  pending: boolean;
  disabled: boolean;
  onImport: () => void;
}) {
  return (
    <li className="flex items-center gap-4 p-3">
      <div className="w-12 shrink-0">
        <BookCover coverId={book.coverId} title={book.title} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-sm font-medium">{book.title}</span>
        <span className="line-clamp-1 text-xs text-muted">
          {book.authors.join(', ')}
          {book.year !== null && <> · {book.year}</>}
        </span>
      </div>
      {book.bookId ? (
        <Link
          href={`/books/${book.bookId}`}
          className={`${buttonClasses('ghost')} shrink-0`}
        >
          In catalog
        </Link>
      ) : (
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={onImport}
          pending={pending}
          pendingLabel="Importing…"
          disabled={disabled}
          aria-label={`Import ${book.title}`}
        >
          Import
        </Button>
      )}
    </li>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-4">
          <div className="aspect-[2/3] w-12 animate-pulse rounded bg-border/50" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-border/50" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-border/40" />
          </div>
        </li>
      ))}
    </ul>
  );
}
