import type { ExecutionContext } from '@nestjs/common';
import { OriginGuard } from './origin.guard.js';

class TestOriginGuard extends OriginGuard {
  protected override allowed(): string[] {
    return ['https://shelfwise.example'];
  }
}

function ctx(method: string, origin?: string): ExecutionContext {
  const req = { method, headers: origin ? { origin } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('OriginGuard', () => {
  const guard = new TestOriginGuard();

  it('lets safe methods through from anywhere', () => {
    expect(guard.canActivate(ctx('GET', 'https://evil.example'))).toBe(true);
  });

  it('allows mutating requests from an allowed origin or without Origin', () => {
    expect(guard.canActivate(ctx('POST', 'https://shelfwise.example'))).toBe(
      true,
    );
    expect(guard.canActivate(ctx('POST'))).toBe(true);
  });

  it('blocks mutating requests from other origins', () => {
    expect(() =>
      guard.canActivate(ctx('POST', 'https://evil.example')),
    ).toThrow('Origin not allowed');
  });
});
