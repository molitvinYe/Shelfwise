import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@shelfwise/shared';

/**
 * Domain error with a machine-readable code from the shared contract.
 * Throw this from services; the global filter turns it into `{ error: { code, message, details } }`.
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
