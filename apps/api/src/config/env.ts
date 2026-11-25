import { z } from 'zod';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    /** Pooled connection used by the app (Neon: the `-pooler` host). Migrations use DIRECT_URL via prisma.config.ts. */
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Enables diagnostic routes such as `GET /health/stream` (SSE spike, docs/adr/0002). Off by default. */
    ENABLE_DEBUG_ROUTES: z.stringbool().default(false),
    /** Git SHA of the deployed build. Render sets RENDER_GIT_COMMIT automatically. */
    RENDER_GIT_COMMIT: z.string().optional(),
  })
  .transform((env) => ({
    ...env,
    // Tests stay quiet unless LOG_LEVEL is set explicitly.
    LOG_LEVEL: env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  }));

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Loads `.env` (if present) and validates the environment once.
 * Exits the process with a readable message on invalid config (fail fast).
 */
export function getEnv(): Env {
  if (cached) return cached;

  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      `Invalid environment configuration (see apps/api/.env.example):\n${z.prettifyError(result.error)}`,
    );
    process.exit(1);
  }
  cached = result.data;
  return cached;
}
