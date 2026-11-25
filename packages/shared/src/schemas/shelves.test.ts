import { describe, expect, it } from 'vitest';
import { UpdateShelfInput, UpsertShelfInput } from './shelves.js';

describe('UpsertShelfInput', () => {
  it('trims reviews and stores an empty one as null', () => {
    expect(
      UpsertShelfInput.parse({ status: 'READ', review: '  Great.  ' }).review,
    ).toBe('Great.');
    expect(
      UpsertShelfInput.parse({ status: 'READ', review: '   ' }).review,
    ).toBeNull();
  });

  it('keeps omitted fields undefined (= unchanged) and explicit nulls (= cleared)', () => {
    expect(UpsertShelfInput.parse({ status: 'WANT' })).toEqual({
      status: 'WANT',
    });
    expect(UpsertShelfInput.parse({ status: 'READ', rating: null })).toEqual({
      status: 'READ',
      rating: null,
    });
  });

  it('rejects out-of-range ratings, unknown statuses and oversized reviews', () => {
    expect(
      UpsertShelfInput.safeParse({ status: 'READ', rating: 6 }).success,
    ).toBe(false);
    expect(
      UpsertShelfInput.safeParse({ status: 'READ', rating: 4.5 }).success,
    ).toBe(false);
    expect(UpsertShelfInput.safeParse({ status: 'DONE' }).success).toBe(false);
    expect(
      UpsertShelfInput.safeParse({ status: 'READ', review: 'x'.repeat(5001) })
        .success,
    ).toBe(false);
  });
});

describe('UpdateShelfInput', () => {
  it('needs at least one field', () => {
    expect(UpdateShelfInput.safeParse({}).success).toBe(false);
    expect(UpdateShelfInput.safeParse({ rating: 3 }).success).toBe(true);
  });
});
