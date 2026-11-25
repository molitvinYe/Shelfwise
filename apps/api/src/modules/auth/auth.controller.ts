import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type AuthResponse,
  LoginInput,
  RegisterInput,
} from '@shelfwise/shared';
import type { Request, Response } from 'express';
import { getEnv } from '../../config/env.js';
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth.cookies.js';
import { AuthService, type Session } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';

/**
 * Only the credential endpoints are rate-limited. `me`, `refresh` and `logout` are also called
 * server-side by the web app (one shared Vercel IP), and refresh tokens can't be brute-forced.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ auth: true, signup: true })
export class AuthController {
  private readonly secure = getEnv().COOKIE_SECURE;

  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @SkipThrottle({ auth: false, signup: false })
  async register(
    @Body({ schema: RegisterInput }) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(body));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ auth: false })
  async login(
    @Body({ schema: LoginInput }) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body));
  }

  @Public()
  @Post('demo')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ auth: false })
  async demo(@Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.respond(res, await this.auth.demo());
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.respond(res, await this.auth.refresh(readRefresh(req)));
    } catch (error) {
      // A dead session: drop the cookies so the client stops retrying.
      clearAuthCookies(res, this.secure);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readRefresh(req));
    clearAuthCookies(res, this.secure);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<AuthResponse> {
    return { user: await this.auth.me(user.id) };
  }

  private respond(res: Response, session: Session): AuthResponse {
    setAuthCookies(res, session, this.secure);
    return { user: session.user };
  }
}

function readRefresh(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value ? value : undefined;
}
