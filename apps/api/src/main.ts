import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { getEnv } from './config/env.js';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  configureApp(app);

  await app.listen(env.PORT);
  logger.log(`API listening on http://localhost:${env.PORT}`, 'Bootstrap');
}
await bootstrap();
