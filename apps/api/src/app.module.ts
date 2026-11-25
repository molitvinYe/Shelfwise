import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { buildLoggerOptions } from './common/logging/logger.options.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { getEnv } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => buildLoggerOptions(getEnv()),
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
