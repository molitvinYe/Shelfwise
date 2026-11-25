import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Role } from '@shelfwise/shared';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { AppException } from '../../common/errors/app.exception.js';
import { getEnv } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './auth.cookies.js';
import type { AuthUser } from './auth.types.js';

const ALG = 'HS256';

const AccessClaims = z.object({
  sub: z.uuid(),
  role: Role,
  isDemo: z.boolean(),
});

export type RotateResult =
  | { kind: 'rotated'; userId: string; refreshToken: string }
  /** A revoked token was presented again: the whole family is now revoked. */
  | { kind: 'reused'; userId: string; familyId: string }
  | { kind: 'invalid' };

/** SHA-256 is enough for 256-bit random tokens; argon2 is for low-entropy passwords (docs/adr/0003). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  private readonly key = new TextEncoder().encode(getEnv().JWT_ACCESS_SECRET);

  constructor(private readonly prisma: PrismaService) {}

  signAccess(user: AuthUser): Promise<string> {
    return new SignJWT({ role: user.role, isDemo: user.isDemo })
      .setProtectedHeader({ alg: ALG })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.key);
  }

  /** Throws 401 `TOKEN_EXPIRED` for an expired token and 401 `UNAUTHENTICATED` for anything else invalid. */
  async verifyAccess(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALG],
      });
      const claims = AccessClaims.parse(payload);
      return { id: claims.sub, role: claims.role, isDemo: claims.isDemo };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new AppException(
          HttpStatus.UNAUTHORIZED,
          'TOKEN_EXPIRED',
          'Access token expired',
        );
      }
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
        'Invalid access token',
      );
    }
  }

  /** Starts a new token family (login / register / demo). */
  async issueRefresh(userId: string): Promise<string> {
    const token = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId: randomUUID(),
        tokenHash: hashRefreshToken(token),
        expiresAt: refreshExpiry(),
      },
    });
    return token;
  }

  /**
   * Revokes the presented token and issues its successor in the same family, atomically.
   * Presenting a revoked token (or losing a race for the same token) revokes the whole family.
   * Returns instead of throwing so that the family revocation commits.
   */
  rotateRefresh(token: string): Promise<RotateResult> {
    const tokenHash = hashRefreshToken(token);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!row) return { kind: 'invalid' };

      const now = new Date();
      const revokeFamily = () =>
        tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: now },
        });

      if (row.revokedAt) {
        await revokeFamily();
        return { kind: 'reused', userId: row.userId, familyId: row.familyId };
      }
      if (row.expiresAt <= now) return { kind: 'invalid' };

      // Conditional update: of two concurrent refreshes with one token, only one wins.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) {
        await revokeFamily();
        return { kind: 'reused', userId: row.userId, familyId: row.familyId };
      }

      const next = generateRefreshToken();
      await tx.refreshToken.create({
        data: {
          userId: row.userId,
          familyId: row.familyId,
          tokenHash: hashRefreshToken(next),
          expiresAt: refreshExpiry(),
        },
      });
      return { kind: 'rotated', userId: row.userId, refreshToken: next };
    });
  }

  /** Logout: revokes every live token in the presented token's family. Unknown tokens are ignored. */
  async revokeFamilyOf(token: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
      select: { familyId: true },
    });
    if (!row) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping on login: drops the user's tokens that expired more than a day ago. */
  async deleteExpired(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
    });
  }
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
}
