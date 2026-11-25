import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, ApiError } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const expired = () =>
  json(401, {
    error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' },
  });

const Item = z.object({ id: z.number() });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('refreshes once for concurrent TOKEN_EXPIRED responses, then retries each', async () => {
    let refreshCalls = 0;
    let fresh = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/refresh') {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        fresh = true;
        return new Response(null, { status: 200 });
      }
      return fresh ? json(200, { id: 1 }) : expired();
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([
      apiFetch('/shelves', Item),
      apiFetch('/shelves', Item),
      apiFetch('/shelves', Item),
    ]);

    expect(results).toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
    expect(refreshCalls).toBe(1);
  });

  it('throws the original error when the refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/auth/refresh'
          ? new Response(null, { status: 401 })
          : expired(),
      ),
    );

    await expect(apiFetch('/shelves', Item)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_EXPIRED',
    });
  });

  it('does not try to refresh for auth endpoints or other 401s', async () => {
    const fetchMock = vi.fn(async () =>
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/login', Item, { method: 'POST' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends JSON bodies and parses the shared error shape', async () => {
    const fetchMock = vi.fn(async () =>
      json(409, { error: { code: 'EMAIL_TAKEN', message: 'Taken' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/register', Item, { method: 'POST', json: { a: 1 } }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        body: '{"a":1}',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
