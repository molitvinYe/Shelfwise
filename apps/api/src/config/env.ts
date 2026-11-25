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

    /** HS256 key for access JWTs (docs/adr/0003). Generate with `openssl rand -base64 48`. */
    JWT_ACCESS_SECRET: z.string().min(32),
    /**
     * Comma-separated origins allowed to send mutating requests (CSRF Origin check).
     * Required in production; defaults to the local web app otherwise.
     */
    ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url().transform((url) => new URL(url).origin))),
    /** Proxy hops in front of the app (Express `trust proxy`): decides which X-Forwarded-For entry is the client IP. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /** Per-IP limit for `/auth/*` per minute. */
    AUTH_THROTTLE_PER_MINUTE: z.coerce.number().int().positive().default(10),
    /** Per-IP limit for `POST /auth/register` per hour. */
    SIGNUP_THROTTLE_PER_HOUR: z.coerce.number().int().positive().default(5),

    /** Contact in the Open Library User-Agent (import on demand, `data:fetch`). */
    OPEN_LIBRARY_CONTACT: z
      .string()
      .min(3)
      .max(200)
      .default('https://github.com/molitvinYe/Shelfwise'),
    /** Per-user limits on Open Library calls (we must not become a free Open Library proxy). */
    IMPORT_PER_HOUR: z.coerce.number().int().positive().default(10),
    /** The demo account is shared by every visitor: a lower, shared budget. */
    IMPORT_PER_HOUR_DEMO: z.coerce.number().int().positive().default(3),
    EXTERNAL_SEARCH_PER_MINUTE: z.coerce.number().int().positive().default(20),

    /** Admin account created by the users seed. Both or neither. */
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ALLOWED_ORIGINS'],
        message: 'Required in production (e.g. https://<web>.vercel.app)',
      });
    }
    if (Boolean(env.ADMIN_EMAIL) !== Boolean(env.ADMIN_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_PASSWORD'],
        message: 'Set both ADMIN_EMAIL and ADMIN_PASSWORD, or neither',
      });
    }
  })
  .transform((env) => ({
    ...env,
    ALLOWED_ORIGINS:
      env.ALLOWED_ORIGINS.length > 0
        ? env.ALLOWED_ORIGINS
        : ['http://localhost:3000'],
    /** Secure cookies everywhere except local dev and tests (plain http). */
    COOKIE_SECURE: env.NODE_ENV === 'production',
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
