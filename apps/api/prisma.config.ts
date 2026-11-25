import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env by itself; real env vars (CI, Render) take precedence.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // The CLI (migrate, studio) needs a direct, non-pooled connection (Neon: DIRECT_URL).
    // The app itself connects through the pooled DATABASE_URL via the pg driver adapter.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
