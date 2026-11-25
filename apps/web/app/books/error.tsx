'use client';

import { Button } from '@/components/ui/button';

/** The API is down or asleep (Render free tier): offer a retry instead of a blank page. */
export default function CatalogError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-3 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        The catalog is unavailable
      </h1>
      <p role="alert" className="text-sm text-muted">
        We couldn’t reach the server. It may be waking up — this takes up to a
        minute on the free hosting tier.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
