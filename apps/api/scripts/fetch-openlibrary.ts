/**
 * Builds the committed catalog snapshot from Open Library (roadmap step 7). Run rarely:
 *   pnpm data:fetch            (~3k books, ~25 min: Open Library is rate-limited)
 * Popular works per curated category from search.json, then descriptions from /works/{id}.json.
 * The seed reads data/books.snapshot.json and never touches the network.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CATEGORIES } from '../src/modules/books/open-library/categories.js';
import { OpenLibraryClient } from '../src/modules/books/open-library/open-library.client.js';
import {
  extractDescription,
  mapSearchDoc,
  SearchDoc,
  type SnapshotBook,
  WorkResponse,
} from '../src/modules/books/open-library/open-library.mapper.js';

const PER_CATEGORY = Number(process.env.PER_CATEGORY ?? 150);
const CONCURRENCY = 2;
const DELAY_MS = 600; // per worker → ~3 req/s overall, within Open Library's limit for identified clients
const OUT = path.join(import.meta.dirname, '..', 'data', 'books.snapshot.json');
const FIELDS =
  'key,title,author_name,first_publish_year,subject,language,cover_i,editions,editions.title,editions.language';

const client = new OpenLibraryClient({
  contact:
    process.env.OPEN_LIBRARY_CONTACT ??
    'https://github.com/molitvinYe/Shelfwise',
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SearchResponse = z.object({ docs: z.array(SearchDoc) });

const books = new Map<string, Omit<SnapshotBook, 'description'>>();

for (const category of CATEGORIES) {
  const q = encodeURIComponent(`subject:"${category.query}"`);
  const { docs } = await client.getJson(
    `/search.json?q=${q}&sort=readinglog&lang=en&limit=${PER_CATEGORY}&fields=${FIELDS}`,
    SearchResponse,
  );
  let added = 0;
  for (const doc of docs) {
    const book = mapSearchDoc(doc, category);
    if (!book) continue;
    const existing = books.get(book.olKey);
    if (existing) {
      existing.subjects = [
        ...new Set([...existing.subjects, ...book.subjects]),
      ].sort();
    } else {
      books.set(book.olKey, book);
      added++;
    }
  }
  console.log(
    `${category.label.padEnd(18)} ${docs.length} docs, +${added} new (total ${books.size})`,
  );
  await sleep(DELAY_MS);
}

const queue = [...books.values()];
const result: SnapshotBook[] = [];
let done = 0;
let failed = 0;

async function worker(): Promise<void> {
  for (let book = queue.shift(); book; book = queue.shift()) {
    let description: string | null = null;
    try {
      description = extractDescription(
        await client.getJson(`${book.olKey}.json`, WorkResponse),
      );
    } catch (error) {
      failed++;
      console.warn(`  ! ${book.olKey}: ${(error as Error).message}`);
    }
    result.push({ ...book, description });
    if (++done % 100 === 0) console.log(`descriptions ${done}/${books.size}`);
    await sleep(DELAY_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

result.sort((a, b) => a.olKey.localeCompare(b.olKey));
const withDescription = result.filter((b) => b.description).length;
await writeFile(
  OUT,
  `${JSON.stringify(
    {
      source:
        'https://openlibrary.org (search.json + works API), data under CC0',
      generatedAt: new Date().toISOString(),
      count: result.length,
      books: result,
    },
    null,
    1,
  )}\n`,
);
console.log(
  `Wrote ${result.length} books (${withDescription} with descriptions, ${failed} failed) to ${path.relative(process.cwd(), OUT)}`,
);
