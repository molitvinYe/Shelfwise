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
      // Unit tests never connect; the URL only satisfies env validation (CI has no .env).
      DATABASE_URL: 'postgresql://unit:unit@localhost:1/unit',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123',
    },
    root: './',
    include: ['**/*.spec.ts'],
  },
});
