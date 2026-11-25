import Link from 'next/link';
import { Suspense } from 'react';
import { LogoutButton } from '@/components/auth/logout-button';
import { buttonClasses } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/api/server';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-mono text-sm font-semibold uppercase tracking-widest text-accent"
          >
            Shelfwise
          </Link>
          <Link
            href="/books"
            className="text-sm text-muted hover:text-foreground"
          >
            Catalog
          </Link>
        </div>
        {/* The session is a request-time read: it streams in behind this boundary. */}
        <Suspense fallback={<NavPlaceholder />}>
          <UserNav />
        </Suspense>
      </nav>
    </header>
  );
}

async function UserNav() {
  // API down → show the logged-out nav rather than breaking every page.
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={`${buttonClasses('ghost')} px-3 py-1.5`}>
          Log in
        </Link>
        <Link
          href="/register"
          className={`${buttonClasses('primary')} px-3 py-1.5`}
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/me"
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="truncate font-medium">{user.displayName}</span>
        {user.isDemo && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
            demo
          </span>
        )}
      </Link>
      <LogoutButton />
    </div>
  );
}

function NavPlaceholder() {
  return (
    <div
      className="h-8 w-36 animate-pulse rounded-lg bg-border/50"
      aria-hidden
    />
  );
}
