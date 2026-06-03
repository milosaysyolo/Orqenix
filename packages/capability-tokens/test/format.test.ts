import { describe, it, expect } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  computeJti,
  decodeToken,
  encodeToken,
} from '../src/format';
import { InvalidTokenFormatError, type CapabilityToken, type TokenPayload } from '../src/contracts';

function fakePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  const base: TokenPayload = {
    iss: 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    sub: 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    aud: 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    iat: 1000,
    nbf: 1000,
    exp: 2000,
    jti: 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    caps: ['read:kb-docs'],
    maxDelegationDepth: 0,
    ...overrides,
  };
  return base;
}

describe('format', () => {
  it('base64url round-trip', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255]);
    expect(Array.from(base64UrlDecode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes));
  });

  it('base64url has no padding', () => {
    expect(base64UrlEncode(new Uint8Array([0]))).not.toMatch(/=/);
  });

  it('computeJti is deterministic', () => {
    const p = fakePayload();
    const { jti: _, ...rest } = p;
    expect(computeJti(rest)).toBe(computeJti(rest));
  });

  it('computeJti changes when payload changes', () => {
    const a = fakePayload();
    const b = fakePayload({ exp: 3000 });
    const { jti: _a, ...ra } = a;
    const { jti: _b, ...rb } = b;
    expect(computeJti(ra)).not.toBe(computeJti(rb));
  });

  it('decodeToken rejects wrong number of parts', () => {
    expect(() => decodeToken('a.b')).toThrow(InvalidTokenFormatError);
    expect(() => decodeToken('a.b.c.d')).toThrow(InvalidTokenFormatError);
  });

  it('decodeToken rejects non-64-byte signature', () => {
    const tok: CapabilityToken = {
      header: { alg: 'EdDSA', typ: 'ORQX', kid: 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as any },
      payload: fakePayload(),
      signature: new Uint8Array(32),
    };
    const enc = encodeToken(tok);
    expect(() => decodeToken(enc)).toThrow(InvalidTokenFormatError);
  });

  it('encode + decode round-trips a valid token', () => {
    const tok: CapabilityToken = {
      header: { alg: 'EdDSA', typ: 'ORQX', kid: 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as any },
      payload: fakePayload(),
      signature: new Uint8Array(64).fill(7),
    };
    const enc = encodeToken(tok);
    const back = decodeToken(enc);
    expect(back.payload.jti).toBe(tok.payload.jti);
    expect(Array.from(back.signature)).toEqual(Array.from(tok.signature));
  });
});
