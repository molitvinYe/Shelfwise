import { execFileSync } from 'node:child_process';

/** Applies all migrations to the test database once before the e2e run. */
export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/shelfwise_test';

  execFileSync('prisma', ['migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
