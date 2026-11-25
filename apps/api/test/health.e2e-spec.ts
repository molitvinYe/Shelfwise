import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  ApiErrorBody,
  HealthResponse,
  ReadinessResponse,
} from '@shelfwise/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function createApp(
  prismaOverride?: Partial<PrismaService>,
): Promise<NestExpressApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (prismaOverride) {
    builder.overrideProvider(PrismaService).useValue(prismaOverride);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('with the test database', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns the shared liveness contract', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(HealthResponse.parse(res.body).status).toBe('ok');
    });

    it('GET /health/ready returns 200 when the database answers', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(ReadinessResponse.parse(res.body)).toEqual({
        status: 'ok',
        db: 'ok',
      });
    });

    it('GET /health/stream emits one SSE event per second, as they happen', async () => {
      const arrivals: number[] = [];
      const startedAt = Date.now();

      const res = await request(app.getHttpServer())
        .get('/health/stream?seconds=2')
        .buffer(true)
        .parse((response, done) => {
          let body = '';
          response.on('data', (chunk: Buffer) => {
            arrivals.push(Date.now() - startedAt);
            body += chunk.toString();
          });
          response.on('end', () => done(null, body));
        })
        .expect(200)
        .expect('content-type', /text\/event-stream/);

      const events = String(res.body)
        .split('\n\n')
        .filter((block) => block.includes('data:'));
      expect(events).toHaveLength(2);
      expect(events[0]).toContain('"tick":1');
      // Streamed, not buffered: the first chunk arrives well before the stream ends.
      expect(arrivals[0]).toBeLessThan(1_800);
    });

    it('GET /health/stream validates its query', async () => {
      await request(app.getHttpServer())
        .get('/health/stream?seconds=0')
        .expect(400);
    });
  });

  describe('with the database down', () => {
    let app: NestExpressApplication;
    const queryRaw = vi.fn(() =>
      Promise.reject(new Error('connect ECONNREFUSED')),
    );

    beforeAll(async () => {
      app = await createApp({
        $queryRaw: queryRaw as unknown as PrismaService['$queryRaw'],
        $disconnect: () => Promise.resolve(),
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health still returns 200 and never queries the database', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);

      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('GET /health/ready returns 503 SERVICE_UNAVAILABLE', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);

      expect(ApiErrorBody.parse(res.body).error.code).toBe(
        'SERVICE_UNAVAILABLE',
      );
    });
  });
});
