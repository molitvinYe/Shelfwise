import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * HTTP-level setup shared by `main.ts` and e2e tests, so tests exercise the same stack as production.
 * (Pipes and filters are registered as providers in AppModule.)
 */
export function configureApp(app: NestExpressApplication): void {
  // Render and the Vercel rewrite sit in front of us: trust one proxy hop for client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.enableShutdownHooks();
}
