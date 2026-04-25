import { hashToken } from '../src/lib/token.js';

describe('hashToken', () => {
  it('returns a stable sha256 hash', () => {
    const value = hashToken('devcollab');

    expect(value).toHaveLength(64);
    expect(value).toBe(hashToken('devcollab'));
  });
});
