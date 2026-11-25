import { DebugRoutesGuard } from './debug-routes.guard.js';

class StubGuard extends DebugRoutesGuard {
  constructor(private readonly enabled: boolean) {
    super();
  }

  protected override isEnabled(): boolean {
    return this.enabled;
  }
}

describe('DebugRoutesGuard', () => {
  it('allows the request when debug routes are enabled', () => {
    expect(new StubGuard(true).canActivate()).toBe(true);
  });

  it('responds 404 NOT_FOUND when debug routes are disabled', () => {
    expect(() => new StubGuard(false).canActivate()).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });
});
