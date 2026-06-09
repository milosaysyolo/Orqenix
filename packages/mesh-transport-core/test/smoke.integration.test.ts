// packages/mesh-transport-core/test/smoke.integration.test.ts
import { describe, it, expect } from 'vitest';
import {
  DefaultTransportRegistry,
  LoopbackTransport,
} from '../src/index.js';
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from '../src/index.js';

describe('Part 1 smoke: two loopback transports via registry', () => {
  it('routes a request from A to B and tears down cleanly', async () => {
    const A = 'scp_b3_A' as ScopeId;
    const B = 'scp_b3_B' as ScopeId;

    const reg = new DefaultTransportRegistry();
    const a = new LoopbackTransport(A);
    const b = new LoopbackTransport(B);

    reg.register(a);
    // In Part 1 we only have one transport kind; register one for B via a sibling registry.
    const regB = new DefaultTransportRegistry();
    regB.register(b);

    b.onRequest(async (r) => ({
      id: r.id,
      status: 'ok',
      payload: new Uint8Array([...r.payload, 0xff]),
    }));

    await a.start();
    await b.start();

    const req: MeshRequest = {
      id: '01HV0R6X3M8YQ9G7F2D5W1KZJP',
      fromScope: A,
      toScope: B,
      capability: 'cap_test' as CapabilityToken,
      method: 'memory.query',
      payload: new Uint8Array([0x10, 0x20]),
      deadlineMs: Date.now() + 1000,
      trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
    };
    const addr: MeshAddress = { kind: 'loopback', scopeId: B };
    const resp = await a.send(addr, req);

    expect(resp.status).toBe('ok');
    expect(resp.payload?.at(-1)).toBe(0xff);

    await a.stop();
    await b.stop();
    expect(a.peers()).toEqual([]);
    expect(b.peers()).toEqual([]);
  });
});
