// packages/mesh-transport-core/test/envelope.test.ts
import { describe, it, expect } from 'vitest';
import {
  encodeRequest,
  decodeRequest,
  encodeResponse,
  decodeResponse,
  bytesEqual,
  newRequestId,
} from '../src/envelope.js';
import type { MeshRequest, MeshResponse, ScopeId, CapabilityToken } from '../src/types.js';

function makeReq(seed: number): MeshRequest {
  return {
    id: `01HV0R6X3M8YQ9G7F2D5W1KZJ${seed.toString(36).padStart(1, 'A').toUpperCase()}`,
    fromScope: `scp_b3_from_${seed}` as ScopeId,
    toScope: `scp_b3_to_${seed}` as ScopeId,
    capability: `cap_${seed}` as CapabilityToken,
    method: 'memory.query',
    payload: new Uint8Array([seed & 0xff, (seed >> 8) & 0xff]),
    deadlineMs: 1_700_000_000_000 + seed,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  };
}

describe('envelope round-trip', () => {
  it('is byte-stable for 1000 fuzz inputs', () => {
    for (let i = 0; i < 1000; i++) {
      const req = makeReq(i);
      const a = encodeRequest(req);
      const b = encodeRequest(decodeRequest(a));
      expect(bytesEqual(a, b)).toBe(true);
    }
  });

  it('rejects floats in envelope fields', () => {
    const req = makeReq(1);
    // Tamper with a float at deadlineMs
    (req as unknown as { deadlineMs: number }).deadlineMs = 1.5;
    expect(() => encodeRequest(req)).toThrow();
  });

  it('encodes and decodes responses', () => {
    const resp: MeshResponse = { id: 'r1', status: 'ok', payload: new Uint8Array([1, 2, 3]) };
    const buf = encodeResponse(resp);
    const back = decodeResponse(buf);
    expect(back.status).toBe('ok');
  });

  it('newRequestId returns unique ULIDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(newRequestId());
    expect(ids.size).toBe(1000);
  });

  it('rejects request with non-Uint8Array payload', () => {
    const req = makeReq(1);
    (req as unknown as { payload: number[] }).payload = [1, 2, 3];
    expect(() => encodeRequest(req)).toThrow('envelope: payload must be Uint8Array');
  });

  it('rejects request with missing traceparent', () => {
    const req = makeReq(1);
    (req as unknown as { trace: { traceparent?: string } }).trace = {};
    expect(() => encodeRequest(req)).toThrow('envelope: trace.traceparent missing');
  });

  it('rejects response with invalid status', () => {
    const resp = { id: 'r2', status: 'invalid' } as MeshResponse;
    expect(() => encodeResponse(resp)).toThrow('envelope: response.status not in enum');
  });
});
