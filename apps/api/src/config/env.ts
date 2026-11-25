import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Git SHA of the deployed build. Render sets RENDER_GIT_COMMIT automatically. */
  RENDER_GIT_COMMIT: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Loads `.env` (if present) and validates the environment. Exits on invalid config. */
export function loadEnv(): Env {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
    process.exit(1);
  }
  return result.data;
}
