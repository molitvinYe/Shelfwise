import { z } from 'zod';

/** Machine-readable error codes shared by api and web. Extended per module. */
export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Error body returned by every failing API request. */
export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
