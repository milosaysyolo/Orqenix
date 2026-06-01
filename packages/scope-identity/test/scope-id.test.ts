import { describe, it, expect } from 'vitest';
import { deriveScopeId, parseScopeId, assertScopeId } from '../src/scope-id';
import { InvalidScopeIdError, SCOPE_ID_PATTERN } from '../src/contracts';
import { generateKeyPair } from '../src/keypair';

describe('scope-id', () => {
  it('derives a format-conforming id', async () => {
    const { publicKey } = await generateKeyPair();
    const id = deriveScopeId(publicKey);
    expect(id).toMatch(SCOPE_ID_PATTERN);
    expect(id).toMatch(/^scope:[A-Z2-7]{32}$/);
  });

  it('is deterministic for the same public key', async () => {
    const { publicKey } = await generateKeyPair();
    const a = deriveScopeId(publicKey);
    const b = deriveScopeId(publicKey);
    expect(a).toBe(b);
  });

  it('produces different ids for different keys', async () => {
    const k1 = await generateKeyPair();
    const k2 = await generateKeyPair();
    expect(deriveScopeId(k1.publicKey)).not.toBe(deriveScopeId(k2.publicKey));
  });

  it('parseScopeId returns null for invalid format', () => {
    expect(parseScopeId('scope:lowercase-not-allowed')).toBeNull();
    expect(parseScopeId('not-a-scope-id')).toBeNull();
    expect(parseScopeId('scope:TOOSHORT')).toBeNull();
    expect(parseScopeId('scope:' + 'A'.repeat(33))).toBeNull();
  });

  it('assertScopeId throws InvalidScopeIdError', () => {
    expect(() => assertScopeId('bad')).toThrow(InvalidScopeIdError);
  });

  it('rejects non-32-byte input', () => {
    expect(() => deriveScopeId(new Uint8Array(16))).toThrow(InvalidScopeIdError);
  });
});
