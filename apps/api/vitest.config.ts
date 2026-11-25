import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Real env vars win over apps/api/.env, so tests stay quiet regardless of local config.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123',
    },
    root: './',
    include: ['**/*.spec.ts'],
  },
});
