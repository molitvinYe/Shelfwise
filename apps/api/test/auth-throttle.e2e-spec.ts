import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiErrorBody } from '@shelfwise/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestPrisma, resetDatabase } from './db.js';

/**
 * Uses the real limits; each test runs from its own client IP via X-Forwarded-For
 * (the app trusts one proxy hop, like behind Render).
 */
describe('Auth rate limiting (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    // env.ts reads process.env lazily on first use, and each test file has its own module graph.
    process.env.AUTH_THROTTLE_PER_MINUTE = '10';
    process.env.SIGNUP_THROTTLE_PER_HOUR = '5';
    prisma = createTestPrisma();
    await resetDatabase(prisma);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('limits login attempts to 10 per minute per IP', async () => {
    const attempt = (ip: string) =>
      http
        .post('/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nobody@example.com', password: 'x' });

    for (let i = 0; i < 10; i++) await attempt('203.0.113.10').expect(401);
    const limited = await attempt('203.0.113.10').expect(429);
    expect(ApiErrorBody.parse(limited.body).error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after-auth']).toBeDefined();

    // Another client is unaffected.
    await attempt('203.0.113.11').expect(401);
  });

  it('limits registrations to 5 per hour per IP', async () => {
    const signup = (i: number) =>
      http
        .post('/auth/register')
        .set('X-Forwarded-For', '203.0.113.20')
        .send({
          email: `user${i}@example.com`,
          password: 'long-enough-pw',
          displayName: 'Reader',
        });

    for (let i = 0; i < 5; i++) await signup(i).expect(201);
    await signup(5).expect(429);
  });

  it('does not limit /auth/me or /auth/refresh (called server-side from one IP)', async () => {
    for (let i = 0; i < 15; i++) {
      await http
        .post('/auth/refresh')
        .set('X-Forwarded-For', '203.0.113.30')
        .expect(401);
    }
  });
});
