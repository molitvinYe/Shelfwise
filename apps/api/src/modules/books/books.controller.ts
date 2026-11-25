import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type BookDetail,
  type BookPage,
  BookSearchQuery,
  PageQuery,
  type ReviewPage,
  type SubjectList,
} from '@shelfwise/shared';
import { Public } from '../auth/decorators/public.decorator.js';
import { BooksService } from './books.service.js';

@Public()
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  search(
    @Query({ schema: BookSearchQuery }) query: BookSearchQuery,
  ): Promise<BookPage> {
    return this.books.search(query);
  }

  /** Declared before `:id` so "subjects" isn't taken for an id. */
  @Get('subjects')
  subjects(): Promise<SubjectList> {
    return this.books.subjects();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BookDetail> {
    return this.books.findById(id);
  }

  @Get(':id/reviews')
  reviews(
    @Param('id') id: string,
    @Query({ schema: PageQuery }) query: PageQuery,
  ): Promise<ReviewPage> {
    return this.books.reviews(id, query);
  }
}
