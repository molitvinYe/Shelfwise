import { HttpStatus, Injectable } from '@nestjs/common';
import type { LoginInput, PublicUser, RegisterInput } from '@shelfwise/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppException } from '../../common/errors/app.exception.js';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { toPublicUser, UsersService } from '../users/users.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

export interface Session {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const unauthenticated = (message = 'Not authenticated') =>
  new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) {}

  async register(input: RegisterInput): Promise<Session> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      const user = await this.users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      });
      return this.startSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'EMAIL_TAKEN',
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  /** Same error and similar timing for an unknown email and a wrong password. */
  async login(input: LoginInput): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    const ok = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !ok) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }
    await this.tokens.deleteExpired(user.id);
    return this.startSession(user);
  }

  /** Logs in the seeded demo user; no credentials ever reach the browser. */
  async demo(): Promise<Session> {
    const user = await this.users.findDemo();
    if (!user) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Demo account is not available',
      );
    }
    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw unauthenticated();

    const result = await this.tokens.rotateRefresh(refreshToken);
    if (result.kind === 'reused') {
      this.logger.warn(
        { userId: result.userId, familyId: result.familyId },
        'Refresh token reuse detected; token family revoked',
      );
      throw unauthenticated('Session expired');
    }
    if (result.kind === 'invalid') throw unauthenticated('Session expired');

    const user = await this.users.findById(result.userId);
    if (!user) throw unauthenticated('Session expired');
    return {
      user: toPublicUser(user),
      accessToken: await this.tokens.signAccess(user),
      refreshToken: result.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.tokens.revokeFamilyOf(refreshToken);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw unauthenticated();
    return toPublicUser(user);
  }

  private async startSession(user: User): Promise<Session> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(user),
      this.tokens.issueRefresh(user.id),
    ]);
    return { user: toPublicUser(user), accessToken, refreshToken };
  }
}
