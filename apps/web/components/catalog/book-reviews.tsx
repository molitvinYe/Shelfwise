'use client';

import { type ReviewItem, ReviewPage } from '@shelfwise/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { apiGet, errorMessage } from '@/lib/api/client';

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/** First page comes from the server; further pages load on demand. */
export function BookReviews({
  bookId,
  initial,
}: {
  bookId: string;
  initial: ReviewPage;
}) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    try {
      const page = await apiGet(
        `/books/${bookId}/reviews?limit=10&cursor=${encodeURIComponent(cursor)}`,
        ReviewPage,
      );
      setReviews((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-4">
      <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
        Reviews
      </h2>
      {reviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          No reviews yet. Shelves and reviews are coming soon.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((r) => (
            <li
              key={r.user.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{r.user.displayName}</span>
                {r.rating !== null && (
                  <span
                    className="text-accent"
                    aria-label={`${r.rating} out of 5`}
                  >
                    {'★'.repeat(r.rating)}
                    <span className="text-border">
                      {'★'.repeat(5 - r.rating)}
                    </span>
                  </span>
                )}
                <time dateTime={r.updatedAt} className="text-xs text-muted">
                  {dateFormat.format(new Date(r.updatedAt))}
                </time>
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                {r.review}
              </p>
            </li>
          ))}
        </ul>
      )}
      <FormAlert message={error} />
      {cursor && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={loadMore}
          pending={pending}
          pendingLabel="Loading…"
        >
          More reviews
        </Button>
      )}
    </section>
  );
}
