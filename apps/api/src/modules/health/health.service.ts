import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@shelfwise/shared';

@Injectable()
export class HealthService {
  private readonly version =
    process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev';

  check(): HealthResponse {
    return HealthResponse.parse({
      status: 'ok',
      service: 'api',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}
