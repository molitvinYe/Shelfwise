import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@shelfwise/shared';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Global guard for `@Roles(...)`. Role comes from the access token, so a change applies
 * at the next refresh (≤ 15 min, docs/adr/0003); admin services re-check the DB.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (user && roles.includes(user.role)) return true;
    throw new AppException(
      HttpStatus.FORBIDDEN,
      'FORBIDDEN',
      'Insufficient permissions',
    );
  }
}
