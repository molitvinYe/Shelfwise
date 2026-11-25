import { HealthResponse } from '@shelfwise/shared';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns a response matching the shared contract', () => {
    const result = new HealthService().check();

    expect(HealthResponse.safeParse(result).success).toBe(true);
    expect(result.status).toBe('ok');
  });
});
