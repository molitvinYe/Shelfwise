import { HttpStatus, Injectable } from '@nestjs/common';
import { HealthResponse, ReadinessResponse } from '@shelfwise/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const DB_CHECK_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  private readonly version =
    process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev';

  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(HealthService.name)
    private readonly logger: PinoLogger,
  ) {}

  /** Liveness: no I/O, so the uptime pinger never wakes the database. */
  check(): HealthResponse {
    return HealthResponse.parse({
      status: 'ok',
      service: 'api',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  /** Readiness: verifies the database answers within a short timeout. */
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
    } catch (error) {
      this.logger.warn({ err: error }, 'Readiness check failed: database');
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Database is unavailable',
      );
    }
    return { status: 'ok', db: 'ok' };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out after ${DB_CHECK_TIMEOUT_MS}ms`)),
        DB_CHECK_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
