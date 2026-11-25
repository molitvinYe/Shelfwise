import { ApiErrorBody } from '@shelfwise/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Browser-side fetch against the same-origin `/api` proxy.
 * Parses the response with a shared Zod schema so contract drift fails loudly.
 */
export async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...init?.headers },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ApiErrorBody.safeParse(body);
    throw parsed.success
      ? new ApiError(
          res.status,
          parsed.data.error.code,
          parsed.data.error.message,
        )
      : new ApiError(
          res.status,
          'INTERNAL_ERROR',
          `Request failed with ${res.status}`,
        );
  }

  return schema.parse(body);
}
