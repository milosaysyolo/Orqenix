import { describe, it, expect } from 'vitest';
import { hashBytes, hashString, isContentHash, verifyContentHash } from '../src/hash';
import { ContentHashMismatchError } from '../src/contracts';

describe('hash', () => {
  it('produces 64-char hex for any input', () => {
    expect(hashString('')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashString('hello')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('is deterministic', () => {
    expect(hashString('x')).toBe(hashString('x'));
  });
  it('differs across different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
  it('verifyContentHash passes on match', () => {
    const bytes = new TextEncoder().encode('hi');
    expect(() => verifyContentHash(bytes, hashBytes(bytes))).not.toThrow();
  });
  it('verifyContentHash throws on mismatch', () => {
    const bytes = new TextEncoder().encode('hi');
    const wrong = hashString('not-hi');
    expect(() => verifyContentHash(bytes, wrong)).toThrow(ContentHashMismatchError);
  });
  it('isContentHash narrows correctly', () => {
    expect(isContentHash(hashString('x'))).toBe(true);
    expect(isContentHash('zzz')).toBe(false);
  });
});
