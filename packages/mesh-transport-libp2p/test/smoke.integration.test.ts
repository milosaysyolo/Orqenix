import { describe, it, expect } from 'vitest';
import { Libp2pMeshTransport } from '../src/transport.js';
import type { CapabilityToken, MeshAddress, MeshRequest, ScopeId } from '@orqenix/mesh-transport-core';

describe('Part 3 smoke: libp2p transport end-to-end', () => {
  it('A -> B over /orqenix/mesh/1.0.0 returns ok, handler called once, clean teardown', async () => {
    const A = new Libp2pMeshTransport({ localScopeId: 'scp_b3_aa' as ScopeId, scopeSeed: new Uint8Array(32).fill(11) });
    const B = new Libp2pMeshTransport({ localScopeId: 'scp_b3_bb' as ScopeId, scopeSeed: new Uint8Array(32).fill(22) });

    let calls = 0;
    B.onRequest(async (r) => {
      calls++;
      return { id: r.id, status: 'ok', payload: new Uint8Array([...r.payload, 0xff]) };
    });

    await A.start();
    await B.start();

    const addrs = B.multiaddrs();
    expect(addrs.length).toBeGreaterThan(0);

    const addr: MeshAddress = { kind: 'libp2p', multiaddr: addrs[0] };
    const req: MeshRequest = {
      id: '01HV0R6X3M8YQ9G7F2D5W1LIBP2P',
      fromScope: 'scp_b3_aa' as ScopeId,
      toScope: 'scp_b3_bb' as ScopeId,
      capability: 'cap_smoke' as CapabilityToken,
      method: 'memory.query',
      payload: new Uint8Array([0x10, 0x20]),
      deadlineMs: Date.now() + 3000,
      trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
    };

    const r1 = await A.send(addr, req);
    expect(r1.status).toBe('ok');
    expect(r1.payload?.at(-1)).toBe(0xff);
    expect(calls).toBe(1);

    await A.stop();
    await B.stop();
    expect(A.peers()).toEqual([]);
    expect(B.peers()).toEqual([]);
  }, 15_000);
});
