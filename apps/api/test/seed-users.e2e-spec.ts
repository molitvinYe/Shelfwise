import type { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_USER, seedUsers } from '../src/seed/seed-users.js';
import { createTestPrisma, resetDatabase } from './db.js';

const ADMIN = { email: 'Admin@Test.local', password: 'admin-password-123' };

describe('seedUsers (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates demo + admin once and is idempotent', async () => {
    expect(await seedUsers(prisma, ADMIN)).toEqual({
      demo: 'created',
      admin: 'created',
    });
    expect(await seedUsers(prisma, ADMIN)).toEqual({
      demo: 'exists',
      admin: 'exists',
    });

    const demo = await prisma.user.findUniqueOrThrow({
      where: { email: DEMO_USER.email },
    });
    expect(demo).toMatchObject({ isDemo: true, passwordHash: null });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@test.local' },
    });
    expect(admin.role).toBe('ADMIN');
  });

  it('never promotes a pre-registered account that owns ADMIN_EMAIL', async () => {
    await prisma.user.create({
      data: {
        email: 'admin@test.local',
        displayName: 'Squatter',
        passwordHash: '$argon2id$attacker',
      },
    });

    expect((await seedUsers(prisma, ADMIN)).admin).toBe('conflict');
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@test.local' },
    });
    expect(user.role).toBe('USER');
    expect(user.passwordHash).toBe('$argon2id$attacker');
  });

  it('skips the admin when no credentials are configured', async () => {
    expect((await seedUsers(prisma, undefined)).admin).toBe('skipped');
  });
});
