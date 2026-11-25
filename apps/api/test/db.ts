import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** Standalone client for e2e tests that need direct DB access (fixtures, assertions). */
export function createTestPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is not set for e2e tests');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Empties every application table. Faster than re-running migrations between tests. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    TRUNCATE "CollectionBook", "Collection", "UserBook", "AiUsage", "AiIpUsage",
             "RefreshToken", "Book", "User"
    RESTART IDENTITY CASCADE
  `;
}
