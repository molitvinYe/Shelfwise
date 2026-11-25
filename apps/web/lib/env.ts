import { z } from 'zod';

const ServerEnvSchema = z.object({
  /** Origin of the NestJS API. Server-only: used by rewrites and Server Components. */
  API_ORIGIN: z.url(),
  /** Public canonical URL of the web app (metadata, OG images). */
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Validates env at startup/build. Throws with a readable message when misconfigured. */
export function getServerEnv(): ServerEnv {
  const result = ServerEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid web environment configuration (see apps/web/.env.example):\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
