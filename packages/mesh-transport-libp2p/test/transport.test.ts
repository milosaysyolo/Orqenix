import { describe, it, expect } from 'vitest';
import { Libp2pMeshTransport } from '../src/transport.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

describe('Libp2pMeshTransport lifecycle', () => {
  it('start/stop is idempotent and peers() is empty after stop', async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: 'scp_b3_aa' as ScopeId,
      scopeSeed: new Uint8Array(32).fill(7),
    });
    await t.start();
    await t.start();
    await t.stop();
    await t.stop();
    expect(t.peers()).toEqual([]);
  }, 10_000);

  it('produces a stable peer ID across two transport instances with the same scope seed', async () => {
    const seed = new Uint8Array(32).fill(9);
    const t1 = new Libp2pMeshTransport({ localScopeId: 'scp_b3_xx' as ScopeId, scopeSeed: seed });
    const t2 = new Libp2pMeshTransport({ localScopeId: 'scp_b3_xx' as ScopeId, scopeSeed: seed });
    await t1.start();
    await t2.start();
    const a1 = t1.multiaddrs()[0] ?? '';
    const a2 = t2.multiaddrs()[0] ?? '';
    expect(a1.split('/p2p/')[1]).toBe(a2.split('/p2p/')[1]);
    await t1.stop();
    await t2.stop();
  }, 10_000);
});
