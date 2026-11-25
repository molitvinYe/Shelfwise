import type { ShelfEntry } from '@shelfwise/shared';
import { describe, expect, it } from 'vitest';
import { applyChange } from './shelf-controls';

const bookId = '0190a0c0-0000-7000-8000-000000000001';
const entry: ShelfEntry = {
  bookId,
  status: 'READ',
  rating: 4,
  review: 'Good',
  isReviewHidden: true,
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('applyChange (optimistic shelf state)', () => {
  it('keeps omitted fields and the moderation flag', () => {
    expect(
      applyChange(entry, { kind: 'put', input: { status: 'READING' } }, bookId),
    ).toMatchObject({
      status: 'READING',
      rating: 4,
      review: 'Good',
      isReviewHidden: true,
    });
  });

  it('clears fields set to null and starts empty for a new entry', () => {
    expect(
      applyChange(
        entry,
        { kind: 'put', input: { status: 'READ', rating: null } },
        bookId,
      )?.rating,
    ).toBeNull();
    expect(
      applyChange(null, { kind: 'put', input: { status: 'WANT' } }, bookId),
    ).toMatchObject({
      status: 'WANT',
      rating: null,
      review: null,
      isReviewHidden: false,
    });
  });

  it('removal empties the entry', () => {
    expect(applyChange(entry, { kind: 'remove' }, bookId)).toBeNull();
  });
});
