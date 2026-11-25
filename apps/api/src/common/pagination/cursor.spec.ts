import { AppException } from '../errors/app.exception.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const id = '0190a0c0-0000-7000-8000-000000000001';

describe('cursor', () => {
  it('round-trips string, number and null keys', () => {
    for (const k of ['Dune', 1965, null, '0.123456']) {
      expect(
        decodeCursor(encodeCursor({ s: 'title', k, id }), 'title'),
      ).toEqual({ s: 'title', k, id });
    }
  });

  it.each([
    ['not base64 json', 'garbage'],
    ['wrong shape', Buffer.from('{"x":1}').toString('base64url')],
    ['bad id', encodeCursor({ s: 'title', k: 'a', id }).replace(/.$/, '!')],
  ])('rejects %s with 400', (_name, cursor) => {
    expect(() => decodeCursor(cursor, 'title')).toThrow(AppException);
  });

  it('rejects a cursor issued for another sort', () => {
    const cursor = encodeCursor({ s: 'year_desc', k: 1965, id });
    expect(() => decodeCursor(cursor, 'title')).toThrow('Invalid cursor');
  });
});
