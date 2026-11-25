import { HealthResponse } from '@shelfwise/shared';
import type { PinoLogger } from 'nestjs-pino';
import { AppException } from '../../common/errors/app.exception.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

function createService(queryRaw: () => Promise<unknown>) {
  const queryRawMock = vi.fn(queryRaw);
  const prisma = { $queryRaw: queryRawMock } as unknown as PrismaService;
  const logger = { warn: vi.fn() } as unknown as PinoLogger;
  return { service: new HealthService(prisma, logger), queryRawMock };
}

describe('HealthService', () => {
  it('check() returns the shared contract without touching the database', () => {
    const { service, queryRawMock } = createService(() => Promise.resolve([]));

    const result = service.check();

    expect(HealthResponse.safeParse(result).success).toBe(true);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it('ready() reports ok when the database answers', async () => {
    const { service } = createService(() =>
      Promise.resolve([{ '?column?': 1 }]),
    );

    await expect(service.ready()).resolves.toEqual({ status: 'ok', db: 'ok' });
  });

  it('ready() throws SERVICE_UNAVAILABLE when the database fails', async () => {
    const { service } = createService(() =>
      Promise.reject(new Error('connection refused')),
    );

    await expect(service.ready()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    } satisfies Partial<AppException>);
  });
});
