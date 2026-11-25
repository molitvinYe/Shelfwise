import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiErrorBody, AuthResponse } from '@shelfwise/shared';
import { SignJWT } from 'jose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { Roles } from '../src/modules/auth/decorators/roles.decorator.js';
import { REUSE_INTERVAL_MS } from '../src/modules/auth/token.service.js';
import { DEMO_USER, seedUsers } from '../src/seed/seed-users.js';
import { cookiesFrom, setCookieLine } from './auth-helpers.js';
import { createTestPrisma, resetDatabase } from './db.js';

@Controller('__test')
class AdminOnlyController {
  @Get('admin')
  @Roles('ADMIN')
  admin() {
    return { ok: true };
  }
}

const ADMIN = { email: 'admin@test.local', password: 'admin-password-123' };
const ORIGIN = 'http://localhost:3000';

function errorCode(body: unknown) {
  return ApiErrorBody.parse(body).error.code;
}

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let http: ReturnType<typeof request>;

  const register = (
    email = 'ada@example.com',
    password = 'correct-horse-battery',
  ) =>
    http
      .post('/auth/register')
      .set('Origin', ORIGIN)
      .send({ email, password, displayName: 'Ada Lovelace' });

  const login = (email: string, password: string) =>
    http.post('/auth/login').set('Origin', ORIGIN).send({ email, password });

  const refresh = (token: string) =>
    http.post('/auth/refresh').set('Cookie', `sw_refresh=${token}`);

  /** Moves every rotation past the reuse interval, so a replay counts as theft. */
  const ageRotations = () =>
    prisma.refreshToken.updateMany({
      where: { rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - REUSE_INTERVAL_MS - 1000) },
    });

  const me = (access: string) =>
    http.get('/auth/me').set('Cookie', `sw_access=${access}`);

  beforeAll(async () => {
    prisma = createTestPrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminOnlyController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedUsers(prisma, ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('register', () => {
    it('creates the user, sets both cookies and normalises the email', async () => {
      const res = await register('  Ada@Example.COM ').expect(201);

      const { user } = AuthResponse.parse(res.body);
      expect(user).toMatchObject({
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        role: 'USER',
        isDemo: false,
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const access = setCookieLine(res, 'sw_access');
      const refreshLine = setCookieLine(res, 'sw_refresh');
      expect(access).toMatch(/HttpOnly/);
      expect(access).toMatch(/SameSite=Lax/);
      expect(access).toMatch(/Path=\//);
      expect(refreshLine).toMatch(/Path=\/;/);
      expect(refreshLine).toMatch(/HttpOnly/);

      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'ada@example.com' },
      });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('returns 409 EMAIL_TAKEN for a duplicate email', async () => {
      await register().expect(201);
      const res = await register('ADA@example.com').expect(409);
      expect(errorCode(res.body)).toBe('EMAIL_TAKEN');
    });

    it('validates input with the shared schema', async () => {
      const res = await http
        .post('/auth/register')
        .send({ email: 'nope', password: 'short', displayName: 'A' })
        .expect(400);
      expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    });
  });

  describe('login', () => {
    it('logs in with the right password', async () => {
      await register();
      const res = await login(
        'ada@example.com',
        'correct-horse-battery',
      ).expect(200);
      expect(AuthResponse.parse(res.body).user.email).toBe('ada@example.com');
      expect(cookiesFrom(res).sw_access).toBeTruthy();
    });

    it('returns the same 401 for a wrong password and an unknown email', async () => {
      await register();
      const wrong = await login('ada@example.com', 'wrong-password').expect(
        401,
      );
      const unknown = await login('nobody@example.com', 'whatever').expect(401);
      expect(errorCode(wrong.body)).toBe('INVALID_CREDENTIALS');
      expect(unknown.body).toEqual(wrong.body);
    });

    it('cannot log into the password-less demo account', async () => {
      const res = await login(DEMO_USER.email, '').expect(400);
      expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
      await login(DEMO_USER.email, 'anything').expect(401);
    });
  });

  describe('demo', () => {
    it('logs in as the seeded demo user', async () => {
      const res = await http
        .post('/auth/demo')
        .set('Origin', ORIGIN)
        .expect(200);
      expect(AuthResponse.parse(res.body).user).toMatchObject({
        email: DEMO_USER.email,
        isDemo: true,
      });
    });

    it('returns 503 when the demo user is missing', async () => {
      await prisma.user.deleteMany({ where: { isDemo: true } });
      const res = await http.post('/auth/demo').expect(503);
      expect(errorCode(res.body)).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('me and the access token', () => {
    it('returns the current user from the access cookie or a bearer token', async () => {
      const { sw_access: access = '' } = cookiesFrom(await register());

      const viaCookie = await me(access).expect(200);
      expect(AuthResponse.parse(viaCookie.body).user.email).toBe(
        'ada@example.com',
      );
      await http
        .get('/auth/me')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
    });

    it('returns 401 UNAUTHENTICATED without a token', async () => {
      const res = await http.get('/auth/me').expect(401);
      expect(errorCode(res.body)).toBe('UNAUTHENTICATED');
    });

    it('returns 401 TOKEN_EXPIRED for an expired access token', async () => {
      const { user } = AuthResponse.parse((await register()).body);
      const now = Math.floor(Date.now() / 1000);
      const expired = await new SignJWT({ role: 'USER', isDemo: false })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt(now - 3600)
        .setExpirationTime(now - 1)
        .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));

      const res = await me(expired).expect(401);
      expect(errorCode(res.body)).toBe('TOKEN_EXPIRED');
    });

    it('rejects a tampered access token', async () => {
      const { sw_access: access = '' } = cookiesFrom(await register());
      const [header, , signature] = access.split('.');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'x', role: 'ADMIN', isDemo: false }),
      ).toString('base64url');

      const res = await me(`${header}.${payload}.${signature}`).expect(401);
      expect(errorCode(res.body)).toBe('UNAUTHENTICATED');
    });
  });

  describe('refresh rotation', () => {
    it('rotates: the new token works, the old one is single-use', async () => {
      const first = cookiesFrom(await register()).sw_refresh ?? '';

      const rotated = await refresh(first).expect(200);
      const second = cookiesFrom(rotated).sw_refresh ?? '';
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);
      expect(cookiesFrom(rotated).sw_access).toBeTruthy();

      await refresh(second).expect(200);
    });

    it('reusing a token rotated outside the reuse interval revokes the whole family', async () => {
      const first = cookiesFrom(await register()).sw_refresh ?? '';
      const second = cookiesFrom(await refresh(first).expect(200)).sw_refresh;
      await ageRotations();

      // An attacker replays the stolen first token…
      const replay = await refresh(first).expect(401);
      expect(errorCode(replay.body)).toBe('UNAUTHENTICATED');
      expect(cookiesFrom(replay).sw_refresh).toBe('');

      // …and the legitimate holder's newer token is dead too.
      await refresh(second ?? '').expect(401);
      const live = await prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(live).toBe(0);
    });

    it('concurrent refreshes with the same token all succeed and keep the family alive', async () => {
      const token = cookiesFrom(await register()).sw_refresh ?? '';
      const results = await Promise.all([
        refresh(token),
        refresh(token),
        refresh(token),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);

      const successors = results.map((r) => cookiesFrom(r).sw_refresh ?? '');
      expect(new Set(successors).size).toBe(3);
      for (const next of successors) await refresh(next).expect(200);
    });

    it('a token rotated moments ago works once more (reuse interval)', async () => {
      const first = cookiesFrom(await register()).sw_refresh ?? '';
      await refresh(first).expect(200);
      await refresh(first).expect(200);
    });

    it('the reuse interval does not revive a logged-out family', async () => {
      const first = cookiesFrom(await register()).sw_refresh ?? '';
      const second = cookiesFrom(await refresh(first).expect(200)).sw_refresh;
      await http
        .post('/auth/logout')
        .set('Cookie', `sw_refresh=${second}`)
        .expect(204);
      await refresh(first).expect(401);
    });

    it('rejects an unknown, expired or missing token', async () => {
      await refresh('not-a-real-token').expect(401);
      await http.post('/auth/refresh').expect(401);

      const token = cookiesFrom(await register()).sw_refresh ?? '';
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refresh(token).expect(401);
    });

    it('stores only a hash of the refresh token', async () => {
      const token = cookiesFrom(await register()).sw_refresh ?? '';
      const rows = await prisma.refreshToken.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).not.toBe(token);
    });
  });

  describe('logout', () => {
    it('revokes the family and clears both cookies', async () => {
      const token = cookiesFrom(await register()).sw_refresh ?? '';

      const res = await http
        .post('/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', `sw_refresh=${token}`)
        .expect(204);
      expect(cookiesFrom(res)).toEqual({ sw_access: '', sw_refresh: '' });

      await refresh(token).expect(401);
    });

    it('succeeds without a session', async () => {
      await http.post('/auth/logout').expect(204);
    });
  });

  describe('login housekeeping', () => {
    it('deletes the user’s refresh tokens that expired more than a day ago', async () => {
      await register();
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      await login('ada@example.com', 'correct-horse-battery').expect(200);
      expect(await prisma.refreshToken.count()).toBe(1);
    });
  });

  describe('roles', () => {
    it('blocks a USER and allows an ADMIN', async () => {
      const userAccess = cookiesFrom(await register()).sw_access ?? '';
      const denied = await http
        .get('/__test/admin')
        .set('Cookie', `sw_access=${userAccess}`)
        .expect(403);
      expect(errorCode(denied.body)).toBe('FORBIDDEN');

      const adminRes = await login(ADMIN.email, ADMIN.password).expect(200);
      expect(AuthResponse.parse(adminRes.body).user.role).toBe('ADMIN');
      await http
        .get('/__test/admin')
        .set('Cookie', `sw_access=${cookiesFrom(adminRes).sw_access}`)
        .expect(200, { ok: true });
    });
  });

  describe('CSRF origin check', () => {
    it('rejects mutating requests from a foreign origin', async () => {
      const res = await http
        .post('/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: ADMIN.email, password: ADMIN.password })
        .expect(403);
      expect(errorCode(res.body)).toBe('FORBIDDEN');
    });
  });
});
