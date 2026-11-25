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

/**
 * A token rotated less than this long ago may be presented again without killing its family.
 * Covers concurrent requests that all carry the same refresh cookie (parallel prefetches hitting
 * the Next.js proxy, two tabs). Same idea as Auth0's "reuse interval". docs/adr/0003.
 */
export const REUSE_INTERVAL_MS = 10_000;
/** At most this many extra successors per rotated token; the next replay counts as theft. */
export const MAX_GRACE_SUCCESSORS = 10;

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
   * A token that was rotated within REUSE_INTERVAL_MS (a concurrent request) gets a successor too,
   * as long as the family is still alive. Any other revoked token = reuse: the family is revoked.
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

      const issueSuccessor = async (): Promise<RotateResult> => {
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
      };
      /**
       * Revoked by a rotation moments ago, the family wasn't killed (logout / reuse) since, and the
       * grace budget isn't spent. Claims one grace slot atomically, so the cap holds under races.
       */
      const isConcurrentUse = async (): Promise<boolean> => {
        const familyAlive =
          (await tx.refreshToken.count({
            where: {
              familyId: row.familyId,
              revokedAt: null,
              expiresAt: { gt: now },
            },
          })) > 0;
        if (!familyAlive) return false;
        const slot = await tx.refreshToken.updateMany({
          where: {
            id: row.id,
            rotatedAt: { gt: new Date(now.getTime() - REUSE_INTERVAL_MS) },
            graceCount: { lt: MAX_GRACE_SUCCESSORS },
          },
          data: { graceCount: { increment: 1 } },
        });
        return slot.count === 1;
      };
      const reuse = async (): Promise<RotateResult> => {
        await revokeFamily();
        return { kind: 'reused', userId: row.userId, familyId: row.familyId };
      };

      if (row.revokedAt) {
        return (await isConcurrentUse()) ? issueSuccessor() : reuse();
      }
      if (row.expiresAt <= now) return { kind: 'invalid' };

      // Conditional update: if a concurrent refresh claimed this token first, re-check it.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now, rotatedAt: now },
      });
      if (claimed.count === 0) {
        return (await isConcurrentUse()) ? issueSuccessor() : reuse();
      }
      return issueSuccessor();
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
