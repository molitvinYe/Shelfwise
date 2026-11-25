import { FixedWindowLimiter } from './fixed-window.limiter.js';

describe('FixedWindowLimiter', () => {
  it('allows `limit` hits per window and key, then 429 with retryAfterSeconds', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(60_000, () => now);

    limiter.consume('a', 2);
    limiter.consume('a', 2);
    limiter.consume('b', 2);
    now = 15_000;
    expect(() => limiter.consume('a', 2)).toThrow(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        details: { retryAfterSeconds: 45 },
      }),
    );

    now = 60_000;
    expect(() => limiter.consume('a', 2)).not.toThrow();
  });
});
