import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { SnapshotBook } from '../modules/books/open-library/open-library.mapper.js';

/** Committed by `pnpm data:fetch`. Same relative location from `src/seed` and `dist/seed`. */
export const SNAPSHOT_PATH = path.join(
  import.meta.dirname,
  '..',
  '..',
  'data',
  'books.snapshot.json',
);

const Snapshot = z.object({
  generatedAt: z.string(),
  count: z.number().int(),
  books: z.array(SnapshotBook),
});

export async function loadSnapshot(
  file = SNAPSHOT_PATH,
): Promise<SnapshotBook[]> {
  const snapshot = Snapshot.parse(JSON.parse(await readFile(file, 'utf8')));
  if (snapshot.books.length !== snapshot.count) {
    throw new Error(
      `Snapshot count mismatch: header says ${snapshot.count}, found ${snapshot.books.length}`,
    );
  }
  return snapshot.books;
}

const BATCH = 500;

/**
 * Insert-only and idempotent: books already in the database (by `olKey`, including ones imported
 * on demand) are left untouched, so re-running is cheap — one key scan plus inserts for new books.
 * `searchVector` is filled by the database trigger.
 */
export async function seedBooks(
  prisma: PrismaClient,
  books: readonly SnapshotBook[],
): Promise<{ inserted: number; existing: number }> {
  const present = new Set(
    (await prisma.book.findMany({ select: { olKey: true } })).map(
      (b) => b.olKey,
    ),
  );
  const missing = books.filter((b) => !present.has(b.olKey));

  let inserted = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const { count } = await prisma.book.createMany({
      data: missing.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += count;
  }
  return { inserted, existing: books.length - missing.length };
}
