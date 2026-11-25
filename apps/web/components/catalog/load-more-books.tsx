'use client';

import { BookPage, type BookListItem } from '@shelfwise/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { apiGet, errorMessage } from '@/lib/api/client';
import { BookCard, bookGridClasses } from './book-card';

/**
 * Appends further result pages under the server-rendered first page. Remount it (via `key`)
 * when the search changes; the cursor belongs to one query.
 */
export function LoadMoreBooks({
  apiQuery,
  initialCursor,
}: {
  apiQuery: string;
  initialCursor: string;
}) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    try {
      const page = await apiGet(
        `/books?${apiQuery}&cursor=${encodeURIComponent(cursor)}`,
        BookPage,
      );
      setBooks((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {books.length > 0 && (
        <ul className={bookGridClasses}>
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {books.length > 0 && `${books.length} more books loaded`}
      </p>
      <FormAlert message={error} />
      {cursor ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={loadMore}
            pending={pending}
            pendingLabel="Loading…"
          >
            {error ? 'Try again' : 'Load more'}
          </Button>
        </div>
      ) : (
        books.length > 0 && (
          <p className="text-center text-sm text-muted">
            That’s everything that matches.
          </p>
        )
      )}
    </>
  );
}
