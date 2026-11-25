import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getEnv } from './config/env.js';

/**
 * HTTP-level setup shared by `main.ts` and e2e tests, so tests exercise the same stack as production.
 * (Pipes and filters are registered as providers in AppModule.)
 */
export function configureApp(app: NestExpressApplication): void {
  // Render (and Vercel's rewrite) sit in front of us; the hop count decides which
  // X-Forwarded-For entry is the client IP used by the rate limiter.
  app.set('trust proxy', getEnv().TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
}
