import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { OriginGuard } from '../../common/guards/origin.guard.js';
import { getEnv } from '../../config/env.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    UsersModule,
    // In-memory storage: a single API instance (docs/adr/0007). Limits are per client IP.
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const env = getEnv();
        return {
          throttlers: [
            {
              name: 'auth',
              ttl: 60_000,
              limit: env.AUTH_THROTTLE_PER_MINUTE,
            },
            {
              name: 'signup',
              ttl: 3_600_000,
              limit: env.SIGNUP_THROTTLE_PER_HOUR,
            },
          ],
          errorMessage: 'Too many requests, please try again later',
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    // Global guards run in this order: CSRF origin check → authentication → roles.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
