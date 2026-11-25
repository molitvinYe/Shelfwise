import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/api/server';

export const metadata: Metadata = { title: 'My shelf' };

/** Placeholder profile page; shelves and stats land in roadmap steps 10–11. */
export default function MePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <section className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
        <h2 className="font-medium text-foreground">Your shelves are empty</h2>
        <p className="mt-1">
          The catalog and shelves arrive in the next steps of the{' '}
          <Link
            href="https://github.com/molitvinYe/Shelfwise/blob/develop/docs/roadmap.md"
            className="text-accent underline-offset-4 hover:underline"
          >
            roadmap
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  // proxy.ts already redirects logged-out visitors; this is the authoritative check.
  if (!user) redirect('/login?next=/me');

  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-3xl font-semibold tracking-tight">
        Hi, {user.displayName}
      </h1>
      <p className="text-sm text-muted">
        Signed in as {user.email}
        {user.isDemo && ' — a shared demo account, data may be reset.'}
      </p>
    </header>
  );
}

function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-border/60" />
      <div className="h-4 w-72 animate-pulse rounded bg-border/40" />
    </div>
  );
}
