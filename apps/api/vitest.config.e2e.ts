import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

/** e2e tests always run against the disposable test database (docker compose `db-test`, CI service). */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/shelfwise_test';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Test files share one database: run them one at a time.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123',
      ENABLE_DEBUG_ROUTES: 'true',
      // Most suites log in many times from one IP; auth-throttle.e2e-spec.ts tests the real limits.
      AUTH_THROTTLE_PER_MINUTE: '1000',
      // Small, so the import limit is reachable in a test.
      IMPORT_PER_HOUR: '3',
      IMPORT_PER_HOUR_DEMO: '1',
      EXTERNAL_SEARCH_PER_MINUTE: '1000',
      SIGNUP_THROTTLE_PER_HOUR: '1000',
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  },
});
