import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@shelfwise/shared';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe for the uptime pinger. Must never touch the database. */
  @Get()
  check(): HealthResponse {
    return this.healthService.check();
  }
}
