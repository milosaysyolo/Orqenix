import { describe, it, expect } from 'vitest';
import { Libp2pMeshTransport } from '../src/transport.js';
import type { CapabilityToken, MeshAddress, MeshRequest, ScopeId } from '@orqenix/mesh-transport-core';

describe('Part 4 smoke: TCP + WebSockets concurrent', () => {
  it('A (tcp+ws) -> B (tcp+ws) ok over both transports, clean teardown', async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_aa' as ScopeId,
      scopeSeed: new Uint8Array(32).fill(11),
      adapters: ['tcp', 'websockets'],
    });
    const B = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_bb' as ScopeId,
      scopeSeed: new Uint8Array(32).fill(22),
      adapters: ['tcp', 'websockets'],
    });

    let calls = 0;
    B.onRequest(async (r) => {
      calls++;
      return { id: r.id, status: 'ok', payload: new Uint8Array([...r.payload, 0x77]) };
    });

    await A.start();
    await B.start();

    const addrs = B.multiaddrs();
    const tcpAddr = addrs.find((a) => /\/tcp\/\d+(\/p2p\/|$)/.test(a) && !/\/ws\//.test(a));
    const wsAddr = addrs.find((a) => /\/ws\//.test(a));
    expect(tcpAddr).toBeDefined();
    expect(wsAddr).toBeDefined();

    function mkReq(id: string): MeshRequest {
      return {
        id,
        fromScope: 'scp_b3_aa' as ScopeId,
        toScope: 'scp_b3_bb' as ScopeId,
        capability: 'cap_smoke' as CapabilityToken,
        method: 'memory.query',
        payload: new Uint8Array([0x10, 0x20]),
        deadlineMs: Date.now() + 3000,
        trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
      };
    }

    const tcpResp = await A.send({ kind: 'libp2p', multiaddr: tcpAddr! } as MeshAddress, mkReq('01HV0R6X3M8YQ9G7F2D5W1TCP55'));
    const wsResp = await A.send({ kind: 'libp2p', multiaddr: wsAddr! } as MeshAddress, mkReq('01HV0R6X3M8YQ9G7F2D5W1WSS55'));

    expect(tcpResp.status).toBe('ok');
    expect(wsResp.status).toBe('ok');
    expect(tcpResp.payload?.at(-1)).toBe(0x77);
    expect(wsResp.payload?.at(-1)).toBe(0x77);
    expect(calls).toBe(2);

    await A.stop();
    await B.stop();
    expect(A.peers()).toEqual([]);
    expect(B.peers()).toEqual([]);
  }, 20_000);
});
