import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiErrorBody } from '@shelfwise/shared';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

const EchoInput = z.object({
  title: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
});
const EchoQuery = z.object({ limit: z.coerce.number().int().max(50) });

/** Test-only controller to exercise the global pipe and filter. */
@Controller('__test')
class TestController {
  @Post('echo')
  echo(@Body({ schema: EchoInput }) body: z.infer<typeof EchoInput>) {
    return body;
  }

  @Get('query')
  query(@Query({ schema: EchoQuery }) query: z.infer<typeof EchoQuery>) {
    return query;
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal detail');
  }
}

describe('App infrastructure (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts valid input, strips unknown keys and applies transforms', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test/echo')
      .send({ title: '  Dune ', rating: 5, extra: 'drop me' })
      .expect(201);

    expect(res.body).toEqual({ title: 'Dune', rating: 5 });
  });

  it('rejects invalid body with VALIDATION_FAILED and field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test/echo')
      .send({ title: '', rating: 9 })
      .expect(400);

    const body = ApiErrorBody.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'title' }),
        expect.objectContaining({ path: 'rating' }),
      ]),
    );
  });

  it('coerces and validates query params', async () => {
    await request(app.getHttpServer())
      .get('/__test/query?limit=20')
      .expect(200, { limit: 20 });
    await request(app.getHttpServer())
      .get('/__test/query?limit=500')
      .expect(400);
  });

  it('returns NOT_FOUND in the shared shape for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/nope').expect(404);

    expect(ApiErrorBody.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('hides internals of unexpected errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test/boom')
      .expect(500);

    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  it('generates a request id, or reuses a valid incoming one', async () => {
    const generated = await request(app.getHttpServer()).get('/health');
    expect(generated.headers['x-request-id']).toMatch(/^[\w-]{8,}$/);

    const reused = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'trace-12345678');
    expect(reused.headers['x-request-id']).toBe('trace-12345678');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
