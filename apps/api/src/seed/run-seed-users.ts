import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedUsers } from './seed-users.js';

/** `node dist/seed/run-seed-users.js` — runs on every production start (after migrations). */
const env = getEnv();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

try {
  const result = await seedUsers(
    prisma,
    env.ADMIN_EMAIL && env.ADMIN_PASSWORD
      ? { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }
      : undefined,
  );
  if (result.admin === 'conflict') {
    console.warn(
      'Seed users: ADMIN_EMAIL belongs to an existing non-admin account; it was NOT promoted. ' +
        'Use another ADMIN_EMAIL, or delete that account if you own it.',
    );
  }
  console.log(
    `Seed users: demo ${result.demo}, admin ${result.admin}` +
      (result.admin === 'skipped'
        ? ' (ADMIN_EMAIL/ADMIN_PASSWORD not set)'
        : ''),
  );
} finally {
  await prisma.$disconnect();
}
