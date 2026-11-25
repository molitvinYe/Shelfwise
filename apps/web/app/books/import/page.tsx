import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ImportSearch } from '@/components/import/import-search';
import { getCurrentUser } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'Import from Open Library',
  robots: { index: false },
};

export default function ImportPage(props: PageProps<'/books/import'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Link
        href="/books"
        className="w-fit text-sm text-muted hover:text-foreground"
      >
        ← Catalog
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Import from Open Library
        </h1>
        <p className="text-sm text-muted">
          Can’t find a book in the catalog? Search Open Library and add it — it
          becomes available to everyone.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="h-10 w-full animate-pulse rounded-lg bg-border/50" />
        }
      >
        <ImportContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function ImportContent({
  searchParams,
}: Pick<PageProps<'/books/import'>, 'searchParams'>) {
  const [{ q }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const initialQuery = typeof q === 'string' ? q.slice(0, 200) : '';
  // proxy.ts already redirects logged-out visitors; this is the authoritative check.
  if (!user)
    redirect(
      `/login?next=${encodeURIComponent(`/books/import${initialQuery ? `?q=${encodeURIComponent(initialQuery)}` : ''}`)}`,
    );

  return <ImportSearch initialQuery={initialQuery} isDemo={user.isDemo} />;
}
