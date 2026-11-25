import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Real env vars win over apps/api/.env, so tests stay quiet regardless of local config.
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
