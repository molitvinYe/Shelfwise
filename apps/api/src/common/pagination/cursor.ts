import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../errors/app.exception.js';

/**
 * Opaque keyset cursor (docs/adr/0005-cursor-pagination.md): base64url JSON of the last row's
 * sort key plus its id. `s` names the ordering it belongs to, so a cursor from one sort can't be
 * replayed against another.
 */
const CursorPayload = z.object({
  s: z.string().max(40),
  k: z.union([z.string().max(400), z.number(), z.null()]),
  id: z.uuid(),
});
export type CursorPayload = z.infer<typeof CursorPayload>;

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Malformed, tampered or foreign cursors become `400 VALIDATION_FAILED`. */
export function decodeCursor(
  cursor: string,
  expectedSort: string,
): CursorPayload {
  let payload: CursorPayload | undefined;
  try {
    const parsed = CursorPayload.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (parsed.success) payload = parsed.data;
  } catch {
    // fall through to the error below
  }
  if (!payload || payload.s !== expectedSort) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Invalid cursor',
      [{ path: 'cursor', message: 'Invalid cursor' }],
    );
  }
  return payload;
}
