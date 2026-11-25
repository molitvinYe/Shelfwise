import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception.js';
import { ACCESS_COOKIE } from '../auth.cookies.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService } from '../token.service.js';

/**
 * Global guard: every route needs a valid access token unless marked `@Public()`.
 * Reads the `sw_access` cookie, falling back to `Authorization: Bearer` (tests, ADR-0002 fallback).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req);
    if (!token) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Not authenticated',
      );
    }
    req.user = await this.tokens.verifyAccess(token);
    return true;
  }
}

function extractAccessToken(req: Request): string | undefined {
  const fromCookie: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
  const [scheme, value] = req.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && value ? value : undefined;
}
