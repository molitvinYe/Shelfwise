import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`API listening on http://localhost:${env.PORT}`, 'Bootstrap');
}
await bootstrap();
