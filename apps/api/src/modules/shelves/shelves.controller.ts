import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  type MyShelfEntry,
  type ShelfEntry,
  ShelfListQuery,
  type ShelfPage,
  UpdateShelfInput,
  UpsertShelfInput,
} from '@shelfwise/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ShelvesService } from './shelves.service.js';

/** All routes need a session; the user always comes from the token, never from the request. */
@Controller('shelves')
export class ShelvesController {
  constructor(private readonly shelves: ShelvesService) {}

  @Get('me')
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: ShelfListQuery }) query: ShelfListQuery,
  ): Promise<ShelfPage> {
    return this.shelves.listForUser(user.id, query);
  }

  /** The viewer's entry for one book (book page). Always 200; `entry: null` when not shelved. */
  @Get('me/books/:bookId')
  entry(
    @CurrentUser() user: AuthUser,
    @Param('bookId') bookId: string,
  ): Promise<MyShelfEntry> {
    return this.shelves.getEntry(user.id, bookId);
  }

  @Put(':bookId')
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('bookId') bookId: string,
    @Body({ schema: UpsertShelfInput }) body: UpsertShelfInput,
  ): Promise<ShelfEntry> {
    return this.shelves.upsert(user.id, bookId, body);
  }

  @Patch(':bookId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('bookId') bookId: string,
    @Body({ schema: UpdateShelfInput }) body: UpdateShelfInput,
  ): Promise<ShelfEntry> {
    return this.shelves.update(user.id, bookId, body);
  }

  @Delete(':bookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('bookId') bookId: string,
  ): Promise<void> {
    return this.shelves.remove(user.id, bookId);
  }
}
