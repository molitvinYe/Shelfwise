import { z } from 'zod';

/** Response of `GET /health` — liveness only, never touches the database. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

/** Response of `GET /health/ready` — checks dependencies (database). 503 with an `ApiErrorBody` otherwise. */
export const ReadinessResponse = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponse>;
