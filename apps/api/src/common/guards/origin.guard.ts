import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getEnv } from '../../config/env.js';
import { AppException } from '../errors/app.exception.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite=Lax (docs/adr/0003): a mutating request that carries
 * an `Origin` header must come from an allowed origin. Browsers always send `Origin` on
 * cross-site POSTs; requests without it (server-to-server, curl) aren't a CSRF vector.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin === undefined || this.allowed().includes(origin)) return true;

    throw new AppException(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'Origin not allowed',
    );
  }

  protected allowed(): string[] {
    return getEnv().ALLOWED_ORIGINS;
  }
}
