import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import {
  type BookDetail,
  type BookPage,
  BookSearchQuery,
  ExternalSearchQuery,
  type ExternalSearchResult,
  ImportBookInput,
  PageQuery,
  type ReviewPage,
  type SubjectList,
} from '@shelfwise/shared';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { BookImportService } from './book-import.service.js';
import { BooksService } from './books.service.js';

/** Reads are public; Open Library search and import need a session (and are limited per user). */
@Controller('books')
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly importer: BookImportService,
  ) {}

  @Public()
  @Get()
  search(
    @Query({ schema: BookSearchQuery }) query: BookSearchQuery,
  ): Promise<BookPage> {
    return this.books.search(query);
  }

  // Static paths are declared before `:id` so they aren't taken for an id.
  @Public()
  @Get('subjects')
  subjects(): Promise<SubjectList> {
    return this.books.subjects();
  }

  @Get('external-search')
  externalSearch(
    @CurrentUser() user: AuthUser,
    @Query({ schema: ExternalSearchQuery }) { q }: ExternalSearchQuery,
  ): Promise<ExternalSearchResult> {
    return this.importer.externalSearch(user, q);
  }

  /** `201` when the book was imported now, `200` when it was already in the catalog. */
  @Post('import')
  async import(
    @CurrentUser() user: AuthUser,
    @Body({ schema: ImportBookInput }) { olKey }: ImportBookInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookDetail> {
    const { book, created } = await this.importer.import(user, olKey);
    res.status(created ? 201 : 200);
    return book;
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string): Promise<BookDetail> {
    return this.books.findById(id);
  }

  @Public()
  @Get(':id/reviews')
  reviews(
    @Param('id') id: string,
    @Query({ schema: PageQuery }) query: PageQuery,
  ): Promise<ReviewPage> {
    return this.books.reviews(id, query);
  }
}
