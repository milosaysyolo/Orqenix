import { describe, it, expect } from 'vitest';
import { Libp2pMeshTransport } from '../src/transport.js';
import type { CapabilityToken, MeshAddress, MeshRequest, ScopeId } from '@orqenix/mesh-transport-core';

function mkSeed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function mkReq(toScope: ScopeId, id: string, deadlineDelta = 3000): MeshRequest {
  return {
    id,
    fromScope: 'scp_b3_aa' as ScopeId,
    toScope,
    capability: 'cap_test' as CapabilityToken,
    method: 'memory.query',
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + deadlineDelta,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  };
}

describe('TCP adapter integration', () => {
  it('A -> B over TCP returns ok with payload, clean teardown', async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_aa' as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ['tcp'],
    });
    const B = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_bb' as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ['tcp'],
    });
    B.onRequest(async (r) => ({ id: r.id, status: 'ok', payload: new Uint8Array([...r.payload, 0xaa]) }));

    await A.start();
    await B.start();

    const addrs = B.multiaddrs();
    expect(addrs.find((a) => /\/tcp\/\d+(\/p2p\/|$)/.test(a) && !/\/ws\//.test(a))).toBeDefined();
    const tcpAddr = addrs.find((a) => /\/tcp\/\d+(\/p2p\/|$)/.test(a) && !/\/ws\//.test(a))!;
    const addr: MeshAddress = { kind: 'libp2p', multiaddr: tcpAddr };

    const resp = await A.send(addr, mkReq('scp_b3_bb' as ScopeId, '01HV0R6X3M8YQ9G7F2D5W1TCP01'));
    expect(resp.status).toBe('ok');
    expect(resp.payload?.at(-1)).toBe(0xaa);

    await A.stop();
    await B.stop();
    expect(A.peers()).toEqual([]);
    expect(B.peers()).toEqual([]);
  }, 15_000);

  it('rejects dial to closed port within deadline', async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_aa' as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ['tcp'],
      dialBackoff: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 20 },
    });
    await A.start();
    const fake: MeshAddress = {
      kind: 'libp2p',
      multiaddr: '/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha',
    };
    const resp = await A.send(fake, mkReq('scp_b3_zz' as ScopeId, '01HV0R6X3M8YQ9G7F2D5W1TCP02', 200));
    expect(['timeout', 'error']).toContain(resp.status);
    await A.stop();
  }, 10_000);
});
