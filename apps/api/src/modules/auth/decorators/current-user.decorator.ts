import {
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../../common/errors/app.exception.js';
import type { AuthUser } from '../auth.types.js';

/** The authenticated user from the access token. Only valid on non-`@Public()` routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Not authenticated',
      );
    }
    return user;
  },
);
