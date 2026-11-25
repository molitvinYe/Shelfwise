import { type CanActivate, HttpStatus, Injectable } from '@nestjs/common';
import { getEnv } from '../../config/env.js';
import { AppException } from '../errors/app.exception.js';

/** Hides diagnostic routes (404, as if they didn't exist) unless ENABLE_DEBUG_ROUTES=true. */
@Injectable()
export class DebugRoutesGuard implements CanActivate {
  canActivate(): boolean {
    if (!this.isEnabled()) {
      throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    }
    return true;
  }

  protected isEnabled(): boolean {
    return getEnv().ENABLE_DEBUG_ROUTES;
  }
}
