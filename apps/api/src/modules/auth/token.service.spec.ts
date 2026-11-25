import { SignJWT } from 'jose';
import type { AppException } from '../../common/errors/app.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { hashRefreshToken, TokenService } from './token.service.js';

const SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const user = {
  id: '0193a1b2-0000-7000-8000-000000000001',
  role: 'USER' as const,
  isDemo: false,
};

describe('TokenService (access JWT)', () => {
  const service = new TokenService({} as PrismaService);

  it('round-trips the identity claims', async () => {
    const token = await service.signAccess(user);
    await expect(service.verifyAccess(token)).resolves.toEqual(user);
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const expired = await new SignJWT({ role: 'USER', isDemo: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(SECRET);

    await expect(service.verifyAccess(expired)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    } satisfies Partial<AppException>);
  });

  it('rejects a token signed with another key', async () => {
    const forged = await new SignJWT({ role: 'ADMIN', isDemo: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('x'.repeat(40)));

    await expect(service.verifyAccess(forged)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects a token with unexpected claims', async () => {
    const bad = await new SignJWT({ role: 'ROOT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('15m')
      .sign(SECRET);

    await expect(service.verifyAccess(bad)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('hashRefreshToken', () => {
  it('is deterministic and does not contain the token', () => {
    const token = 'abc123';
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
