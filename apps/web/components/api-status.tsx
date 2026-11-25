'use client';

import { HealthResponse } from '@shelfwise/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/** Shows whether the API is reachable through the same-origin `/api` proxy. */
export function ApiStatus() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiGet('/health', HealthResponse, { signal }),
    refetchInterval: 15_000,
  });

  return (
    <section
      aria-labelledby="status-heading"
      className="w-full rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="status-heading" className="text-sm font-semibold">
          System status
        </h2>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md px-2 py-1 text-xs text-muted hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {isFetching ? 'Checking…' : 'Recheck'}
        </button>
      </div>

      <dl className="mt-4 grid gap-3 text-sm" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Web (Next.js)</dt>
          <dd className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-ok" aria-hidden />
            Online
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">
            API (NestJS via <code className="font-mono">/api</code>)
          </dt>
          <dd className="flex items-center gap-2">
            {isPending ? (
              <>
                <span
                  className="size-2 animate-pulse rounded-full bg-muted"
                  aria-hidden
                />
                Checking…
              </>
            ) : isError ? (
              <>
                <span className="size-2 rounded-full bg-danger" aria-hidden />
                Unreachable
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-ok" aria-hidden />
                Online
              </>
            )}
          </dd>
        </div>

        {data && (
          <div className="flex items-center justify-between gap-4 font-mono text-xs text-muted">
            <dt className="sr-only">API build</dt>
            <dd>version {data.version}</dd>
            <dd>uptime {formatUptime(data.uptimeSeconds)}</dd>
          </div>
        )}
      </dl>

      {isError && (
        <p role="alert" className="mt-4 text-xs text-danger">
          Can’t reach the API. Is it running on{' '}
          <code className="font-mono">API_ORIGIN</code>? Start everything with{' '}
          <code className="font-mono">pnpm dev</code>.
        </p>
      )}
    </section>
  );
}
