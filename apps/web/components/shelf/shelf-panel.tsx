import Link from 'next/link';
import { getCurrentUser, getMyShelfEntry } from '@/lib/api/server';
import { ShelfControls } from './shelf-controls';

/**
 * The viewer's shelf controls for a book. A request-time island: the rest of the book page is
 * cached and shared by everyone, this part reads the session (render it inside `<Suspense>`).
 */
export async function ShelfPanel({ bookId }: { bookId: string }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <p className="rounded-2xl border border-border p-4 text-sm text-muted">
        <Link
          href={`/login?next=${encodeURIComponent(`/books/${bookId}`)}`}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          Log in
        </Link>{' '}
        to put this book on a shelf, rate and review it.
      </p>
    );
  }

  const entry = await getMyShelfEntry(bookId).catch(() => undefined);
  if (entry === undefined) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-border p-4 text-sm text-muted"
      >
        Couldn’t load your shelf right now. Reload the page to try again.
      </p>
    );
  }
  return <ShelfControls bookId={bookId} initial={entry} />;
}

export function ShelfPanelSkeleton() {
  return (
    <div
      className="h-28 w-full animate-pulse rounded-2xl bg-border/40"
      aria-hidden
    />
  );
}
