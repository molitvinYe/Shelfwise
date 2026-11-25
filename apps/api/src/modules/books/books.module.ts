import { Module } from '@nestjs/common';
import { getEnv } from '../../config/env.js';
import { BookImportService } from './book-import.service.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';
import { OpenLibraryClient } from './open-library/open-library.client.js';

@Module({
  controllers: [BooksController],
  providers: [
    BooksService,
    BookImportService,
    {
      // Request path: short timeout and one retry (docs/architecture.md#api-conventions).
      // e2e tests replace it with a fake via `overrideProvider(OpenLibraryClient)`.
      provide: OpenLibraryClient,
      useFactory: () =>
        new OpenLibraryClient({
          contact: getEnv().OPEN_LIBRARY_CONTACT,
          timeoutMs: 5_000,
          retries: 1,
        }),
    },
  ],
  exports: [BooksService],
})
export class BooksModule {}
