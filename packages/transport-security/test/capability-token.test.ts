import { describe, it, expect } from 'vitest';
import {
  canonicalSigningBytes,
  decodeCapabilityToken,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from '../src/capability-token.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

function mk(over: Partial<CapabilityTokenFields> = {}): CapabilityTokenFields {
  return {
    iss: 'scp_b3_B' as ScopeId,
    sub: 'scp_b3_A' as ScopeId,
    caps: ['memory.query', 'kb.recall.*'],
    exp: Date.now() + 60_000,
    jti: '01HV0R6X3M8YQ9G7F2D5W1KZJP',
    sig: 'noop',
    ...over,
  };
}

describe('capability token codec', () => {
  it('encode then decode is round-trip', () => {
    const t = mk();
    const wire = encodeCapabilityToken(t);
    const back = decodeCapabilityToken(String(wire));
    expect(back.iss).toBe(t.iss);
    expect([...back.caps].sort()).toEqual([...t.caps].sort());
    expect(back.exp).toBe(t.exp);
  });

  it('canonical signing bytes are deterministic', () => {
    const t = mk();
    const a = canonicalSigningBytes(t);
    const b = canonicalSigningBytes({ ...t, caps: [...t.caps].reverse() });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('rejects malformed inputs', () => {
    expect(() => decodeCapabilityToken('not-base64url!!!')).toThrow();
  });

  it('rejects negative exp', () => {
    const broken = encodeCapabilityToken(mk({ exp: -1 }));
    expect(() => decodeCapabilityToken(String(broken))).toThrow();
  });
});
