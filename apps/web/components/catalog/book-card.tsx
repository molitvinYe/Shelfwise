import type { BookListItem } from '@shelfwise/shared';
import Link from 'next/link';
import { BookCover } from './book-cover';

export function BookCard({
  book,
  priority = false,
}: {
  book: BookListItem;
  priority?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/books/${book.id}`}
        className="group flex flex-col gap-2 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <BookCover
          coverId={book.coverId}
          title={book.title}
          priority={priority}
          className="transition group-hover:opacity-90"
        />
        <span className="flex flex-col gap-0.5 px-0.5">
          <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-accent">
            {book.title}
          </span>
          <span className="line-clamp-1 text-xs text-muted">
            {book.authors.join(', ')}
            {book.year !== null && <> · {book.year}</>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export const bookGridClasses =
  'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

export function BookGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul className={bookGridClasses} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 p-1">
          <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-border/50" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-border/50" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-border/40" />
        </li>
      ))}
    </ul>
  );
}
