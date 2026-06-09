import { describe, it, expect } from 'vitest';
import { canonicalize, bytesEqual } from '../src/canonical.js';
import { encodeRequest, decodeRequest } from '../src/envelope.js';
import type { MeshRequest, ScopeId, CapabilityToken } from '../src/types.js';

describe('canonical encoding', () => {
  it('canonicalize sorts object keys recursively', () => {
    const a = { b: 1, a: 2, c: { z: 3, x: 4 } };
    const c = canonicalize(a) as Record<string, unknown>;
    expect(Object.keys(c)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(c.c as Record<string, unknown>)).toEqual(['x', 'z']);
  });

  it('canonicalize preserves arrays in order', () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('canonicalize preserves Uint8Array as-is', () => {
    const u = new Uint8Array([1, 2, 3]);
    expect(canonicalize(u)).toBe(u);
  });

  it('encodeRequest is byte-stable across insertion-order variants', () => {
    const a: MeshRequest = {
      id: '01HVZZZ',
      fromScope: 'scp_b3_A' as ScopeId,
      toScope: 'scp_b3_B' as ScopeId,
      capability: 'cap_x' as CapabilityToken,
      method: 'm',
      payload: new Uint8Array([1, 2]),
      deadlineMs: 1_700_000_000_000,
      trace: { traceparent: '00-0af-b7a-01' },
    };
    const b: MeshRequest = {
      trace: { traceparent: '00-0af-b7a-01' },
      deadlineMs: 1_700_000_000_000,
      payload: new Uint8Array([1, 2]),
      method: 'm',
      capability: 'cap_x' as CapabilityToken,
      toScope: 'scp_b3_B' as ScopeId,
      fromScope: 'scp_b3_A' as ScopeId,
      id: '01HVZZZ',
    };
    expect(bytesEqual(encodeRequest(a), encodeRequest(b))).toBe(true);
  });

  it('encodeRequest round-trip is byte-stable over 1000 fuzz inputs', () => {
    for (let i = 0; i < 1000; i++) {
      const req: MeshRequest = {
        id: `01HVZ${i}`,
        fromScope: 'scp_b3_X' as ScopeId,
        toScope: 'scp_b3_Y' as ScopeId,
        capability: `cap_${i}` as CapabilityToken,
        method: 'memory.query',
        payload: new Uint8Array([i & 0xff, (i >> 8) & 0xff]),
        deadlineMs: 1_700_000_000_000 + i,
        trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
      };
      const a = encodeRequest(req);
      const b = encodeRequest(decodeRequest(a));
      expect(bytesEqual(a, b)).toBe(true);
    }
  });
});