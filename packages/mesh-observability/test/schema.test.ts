import { describe, it, expect } from 'vitest';
import { CANONICAL_EVENTS, validateLogEvent } from '../src/schema.js';
import type { MeshLogEvent } from '../src/schema.js';

const VALID: MeshLogEvent = {
  ts: '2026-06-04T08:21:17.483Z',
  level: 'info',
  event: 'rpc.in',
  scopeId: 'scp_b3_aa' as any,
  transport: 'libp2p',
  requestId: '01HV0R6X3M8YQ9G7F2D5W1KZJP',
  method: 'memory.query',
};

describe('schema', () => {
  it('accepts the canonical event sample', () => {
    expect(validateLogEvent(VALID)).toBeNull();
  });

  it('rejects unknown fields', () => {
    expect(validateLogEvent({ ...VALID, extra: 1 })).not.toBeNull();
  });

  it('rejects non-canonical event names', () => {
    expect(validateLogEvent({ ...VALID, event: 'rpc.maybe' })).not.toBeNull();
  });

  it('rejects malformed ts', () => {
    expect(validateLogEvent({ ...VALID, ts: '2026/06/04' })).not.toBeNull();
  });

  it('exposes all 13 canonical events', () => {
    expect(CANONICAL_EVENTS.size).toBe(13);
  });
});
