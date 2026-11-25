import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma Client over the `pg` driver adapter (Prisma 7).
 * Connects lazily on the first query, so `/health` stays DB-free and the app boots without waking Neon.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: getEnv().DATABASE_URL,
        // Fail fast instead of hanging when the database is unreachable.
        connectionTimeoutMillis: 5_000,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
