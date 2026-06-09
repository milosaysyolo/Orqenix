// packages/mesh-transport-core/test/loopback.test.ts
import { describe, it, expect } from 'vitest';
import { LoopbackTransport } from '../src/loopback.js';
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from '../src/types.js';

const A = 'scp_b3_A' as ScopeId;
const B = 'scp_b3_B' as ScopeId;

function req(toScope: ScopeId, deadlineMs: number, method = 'memory.query'): MeshRequest {
  return {
    id: '01HV0R6X3M8YQ9G7F2D5W1KZJP',
    fromScope: A,
    toScope,
    capability: 'cap_test' as CapabilityToken,
    method,
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  };
}

describe('LoopbackTransport', () => {
  it('start/stop are idempotent and peers() is empty after stop', async () => {
    const t = new LoopbackTransport(A);
    await t.start();
    await t.start(); // no throw
    await t.stop();
    await t.stop(); // no throw
    expect(t.peers()).toEqual([]);
  });

  it('delivers a request to a peer handler', async () => {
    const a = new LoopbackTransport(A);
    const b = new LoopbackTransport(B);

    b.onRequest(async (r) => ({
      id: r.id,
      status: 'ok',
      payload: new Uint8Array([...r.payload, 99]),
    }));

    await a.start();
    await b.start();

    const addr: MeshAddress = { kind: 'loopback', scopeId: B };
    const resp = await a.send(addr, req(B, Date.now() + 1000));
    expect(resp.status).toBe('ok');
    expect(resp.payload?.at(-1)).toBe(99);

    await a.stop();
    await b.stop();
  });

  it('returns timeout when handler exceeds deadline', async () => {
    const a = new LoopbackTransport(A);
    const b = new LoopbackTransport(B);

    b.onRequest(async (r) => {
      await new Promise((res) => setTimeout(res, 200));
      return { id: r.id, status: 'ok' };
    });

    await a.start();
    await b.start();

    const addr: MeshAddress = { kind: 'loopback', scopeId: B };
    const resp = await a.send(addr, req(B, Date.now() + 50));
    expect(resp.status).toBe('timeout');

    await a.stop();
    await b.stop();
  });

  it('rejects non-loopback address', async () => {
    const a = new LoopbackTransport(A);
    await a.start();

    const addr: MeshAddress = { kind: 'http', baseUrl: 'http://x' };
    const resp = await a.send(addr, req(B, Date.now() + 1000));
    expect(resp.status).toBe('error');
    expect(resp.error?.message).toContain('loopback cannot reach');

    await a.stop();
  });

  it('handles missing peer gracefully', async () => {
    const a = new LoopbackTransport(A);
    const b = new LoopbackTransport(B);
    await a.start();
    await b.start();

    const addr: MeshAddress = { kind: 'loopback', scopeId: 'scp_b3_nonexistent' as ScopeId };
    const resp = await a.send(addr, req('scp_b3_nonexistent' as ScopeId, Date.now() + 1000));
    expect(resp.status).toBe('error');
    expect(resp.error?.message).toContain('peer not present');

    await a.stop();
    await b.stop();
  });

  it('works with AbortSignal (pre-aborted)', async () => {
    const a = new LoopbackTransport(A);
    const b = new LoopbackTransport(B);

    b.onRequest(async (r) => {
      await new Promise((res) => setTimeout(res, 500));
      return { id: r.id, status: 'ok' };
    });

    await a.start();
    await b.start();

    const ac = new AbortController();
    ac.abort();
    const addr: MeshAddress = { kind: 'loopback', scopeId: B };
    const resp = await a.send(addr, req(B, Date.now() + 5000), { signal: ac.signal });
    expect(resp.status).toBe('timeout');

    await a.stop();
    await b.stop();
  });
});
