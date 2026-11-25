import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';

export default function BookNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-3 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Book not found</h1>
      <p className="text-sm text-muted">
        It may have been removed, or the link is mistyped.
      </p>
      <Link href="/books" className={buttonClasses('primary')}>
        Browse the catalog
      </Link>
    </main>
  );
}
