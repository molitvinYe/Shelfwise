import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { loadSnapshot, seedBooks } from './seed-books.js';
import { seedUsers } from './seed-users.js';

/**
 * `node dist/seed/run-seed.js` — runs on every production start (after migrations) and via
 * `pnpm db:seed` locally. Every step is idempotent.
 */
const env = getEnv();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

try {
  const users = await seedUsers(
    prisma,
    env.ADMIN_EMAIL && env.ADMIN_PASSWORD
      ? { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }
      : undefined,
  );
  if (users.admin === 'conflict') {
    console.warn(
      'Seed users: ADMIN_EMAIL belongs to an existing non-admin account; it was NOT promoted. ' +
        'Use another ADMIN_EMAIL, or delete that account if you own it.',
    );
  }
  console.log(
    `Seed users: demo ${users.demo}, admin ${users.admin}` +
      (users.admin === 'skipped'
        ? ' (ADMIN_EMAIL/ADMIN_PASSWORD not set)'
        : ''),
  );

  const books = await seedBooks(prisma, await loadSnapshot());
  console.log(
    `Seed books: ${books.inserted} inserted, ${books.existing} already present`,
  );
} finally {
  await prisma.$disconnect();
}
