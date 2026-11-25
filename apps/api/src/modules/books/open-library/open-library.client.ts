import { z } from 'zod';

export const OPEN_LIBRARY_ORIGIN = 'https://openlibrary.org';

export interface OpenLibraryClientOptions {
  /** Contact for the User-Agent (Open Library asks for one; identified clients get higher limits). */
  contact: string;
  timeoutMs?: number;
  retries?: number;
}

export class OpenLibraryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OpenLibraryError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal Open Library HTTP client: timeout, retry with backoff on 429 / 5xx / network errors. */
export class OpenLibraryClient {
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor({
    contact,
    timeoutMs = 15_000,
    retries = 3,
  }: OpenLibraryClientOptions) {
    this.userAgent = `Shelfwise/0.2 (${contact})`;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
  }

  async getJson<T extends z.ZodType>(
    path: string,
    schema: T,
  ): Promise<z.infer<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
      try {
        const res = await fetch(`${OPEN_LIBRARY_ORIGIN}${path}`, {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.status === 429 || res.status >= 500) {
          lastError = new OpenLibraryError(
            `Open Library ${res.status} for ${path}`,
            res.status,
          );
          continue;
        }
        if (!res.ok) {
          throw new OpenLibraryError(
            `Open Library ${res.status} for ${path}`,
            res.status,
          );
        }
        return schema.parse(await res.json());
      } catch (error) {
        // 4xx and unexpected payloads won't get better on retry.
        if (
          error instanceof OpenLibraryError &&
          error.status &&
          error.status < 500
        )
          throw error;
        if (error instanceof z.ZodError) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new OpenLibraryError(`Open Library request failed for ${path}`);
  }
}
