import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { buildLoggerOptions } from './common/logging/logger.options.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { getEnv } from './config/env.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BooksModule } from './modules/books/books.module.js';
import { ShelvesModule } from './modules/shelves/shelves.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => buildLoggerOptions(getEnv()),
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    BooksModule,
    ShelvesModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
