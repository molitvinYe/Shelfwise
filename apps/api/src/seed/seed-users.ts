import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '../generated/prisma/client.js';

export const DEMO_USER = {
  email: 'demo@shelfwise.app',
  displayName: 'Demo Reader',
} as const;

export interface SeedUsersResult {
  demo: 'created' | 'exists';
  /**
   * `conflict`: a non-admin account already owns ADMIN_EMAIL. It is NOT promoted — registration
   * is open and unverified, so anyone could have pre-registered that address.
   */
  admin: 'created' | 'exists' | 'conflict' | 'skipped';
}

/**
 * Idempotent: safe to run on every start. Never overwrites an existing password,
 * so rotating ADMIN_PASSWORD after the first deploy has no effect (change it in the app instead).
 */
export async function seedUsers(
  prisma: PrismaClient,
  admin: { email: string; password: string } | undefined,
): Promise<SeedUsersResult> {
  const existingDemo = await prisma.user.findUnique({
    where: { email: DEMO_USER.email },
  });
  if (!existingDemo) {
    // No password hash: the demo account can only be entered through POST /auth/demo.
    await prisma.user.create({
      data: { ...DEMO_USER, passwordHash: null, isDemo: true },
    });
  }

  let adminResult: SeedUsersResult['admin'] = 'skipped';
  if (admin) {
    const email = admin.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          displayName: 'Admin',
          passwordHash: await hash(admin.password),
          role: 'ADMIN',
        },
      });
      adminResult = 'created';
    } else {
      adminResult = existing.role === 'ADMIN' ? 'exists' : 'conflict';
    }
  }

  return { demo: existingDemo ? 'exists' : 'created', admin: adminResult };
}
