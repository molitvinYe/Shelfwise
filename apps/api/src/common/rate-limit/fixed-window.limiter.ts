import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window counter keyed by anything (usually a user id). The API runs as a single
 * instance (docs/adr/0007), so memory is enough; a restart resets the windows, which is fine for
 * abuse protection. `@nestjs/throttler` keys by IP, and these limits are per user.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one hit for `key`; throws `429 RATE_LIMITED` once `limit` is exceeded in the window. */
  consume(key: string, limit: number): void {
    const now = this.now();
    if (this.windows.size > 10_000) this.prune(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    if (window.count >= limit) {
      const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        'RATE_LIMITED',
        'Too many requests, please try again later',
        { retryAfterSeconds },
      );
    }
    window.count++;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
