import {
  Controller,
  Get,
  type MessageEvent,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@shelfwise/shared';
import type { Request } from 'express';
import { interval, map, type Observable, take } from 'rxjs';
import { z } from 'zod';
import { DebugRoutesGuard } from '../../common/guards/debug-routes.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

const StreamQuery = z.object({
  seconds: z.coerce.number().int().min(1).max(120).default(60),
});
type StreamQuery = z.infer<typeof StreamQuery>;

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness probe for the uptime pinger. Must never touch the database. */
  @Get()
  check(): HealthResponse {
    return this.healthService.check();
  }

  /** Readiness probe: 200 when the database answers, 503 otherwise. */
  @Get('ready')
  ready(): Promise<ReadinessResponse> {
    return this.healthService.ready();
  }

  /**
   * SSE spike (docs/adr/0002): one event per second for `seconds` (default 60).
   * Used to verify that the Vercel → Render rewrite streams events instead of buffering them.
   * Disabled (404) unless ENABLE_DEBUG_ROUTES=true.
   */
  @Sse('stream')
  @UseGuards(DebugRoutesGuard)
  stream(
    @Query({ schema: StreamQuery }) { seconds }: StreamQuery,
  ): Observable<MessageEvent> {
    const startedAt = Date.now();
    return interval(1_000).pipe(
      take(seconds),
      map((i) => ({
        id: String(i + 1),
        data: {
          tick: i + 1,
          of: seconds,
          serverElapsedMs: Date.now() - startedAt,
          at: new Date().toISOString(),
        },
      })),
    );
  }

  /**
   * Shows how the client IP is resolved behind Render + Vercel (sets TRUST_PROXY_HOPS for the
   * auth rate limiter). Disabled (404) unless ENABLE_DEBUG_ROUTES=true.
   */
  @Get('client-ip')
  @UseGuards(DebugRoutesGuard)
  clientIp(@Req() req: Request): {
    ip: string | undefined;
    forwardedFor: string | undefined;
  } {
    const forwardedFor = req.headers['x-forwarded-for'];
    return {
      ip: req.ip,
      forwardedFor: Array.isArray(forwardedFor)
        ? forwardedFor.join(', ')
        : forwardedFor,
    };
  }
}
