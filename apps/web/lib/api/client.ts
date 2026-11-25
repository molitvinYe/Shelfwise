import { ApiErrorBody } from '@shelfwise/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** JSON body; sets `Content-Type: application/json`. */
  json?: unknown;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Rotates the session once for all callers: concurrent requests that hit `TOKEN_EXPIRED`
 * await the same refresh instead of each spending the (single-use) refresh token.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Browser-side request against the same-origin `/api` proxy (docs/adr/0002).
 * On `401 TOKEN_EXPIRED` it refreshes the session once and retries; if that fails the user
 * is sent to `/login`. Successful bodies are parsed with a shared Zod schema.
 */
export async function apiFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: ApiRequestInit,
): Promise<z.infer<T>>;
export async function apiFetch(
  path: string,
  schema?: undefined,
  init?: ApiRequestInit,
): Promise<void>;
export async function apiFetch(
  path: string,
  schema?: z.ZodType,
  init: ApiRequestInit = {},
): Promise<unknown> {
  let res = await send(path, init);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const error = await toApiError(res.clone());
    if (error.code === 'TOKEN_EXPIRED') {
      if (await refreshSession()) {
        res = await send(path, init);
      } else {
        redirectToLogin();
        throw error;
      }
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (!schema || res.status === 204) return undefined;
  return schema.parse(await res.json());
}

/** GET shorthand. */
export function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: ApiRequestInit,
): Promise<z.infer<T>> {
  return apiFetch(path, schema, init);
}

function send(path: string, { json, headers, ...init }: ApiRequestInit) {
  return fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = ApiErrorBody.safeParse(body);
  return parsed.success
    ? new ApiError(
        res.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
      )
    : new ApiError(
        res.status,
        'INTERNAL_ERROR',
        `Request failed with ${res.status}`,
      );
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = `${window.location.pathname}${window.location.search}`;
  // A full navigation on purpose: the session is gone, so drop all client state with it.
  // (There is no router outside components.)
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

/** Human-readable message for an error thrown by `apiFetch` (or anything else). */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Check your connection and try again.';
  }
  switch (error.code) {
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'SERVICE_UNAVAILABLE':
    case 'UPSTREAM_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return 'The server is having trouble right now. Please try again shortly.';
    default:
      return error.message;
  }
}
