import { describe, it, expect, vi } from 'vitest';
import { makeInboundDispatch, type StructuralCapabilityVerifier } from '../src/inbound.js';
import { CrossTransportDedup } from '../src/dedup.js';
import { MeshLogger, MeshMetrics, bufferSink } from '@orqenix/mesh-observability';
import type { MeshRequest, MeshResponse, ScopeId } from '@orqenix/mesh-transport-core';

function mkReq(): MeshRequest {
  return {
    id: '01HV0R6X3M8YQ9G7F2D5W1INB01',
    fromScope: 'scp_b3_A' as ScopeId,
    toScope: 'scp_b3_B' as ScopeId,
    capability: 'cap_test' as unknown as any,
    method: 'memory.query',
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + 1000,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  } as unknown as MeshRequest;
}

function okVerifier(): StructuralCapabilityVerifier {
  return { async verify() { return { ok: true, token: {} }; } };
}
function denyVerifier(code = 'E_CAP_EXPIRED'): StructuralCapabilityVerifier {
  return { async verify() { return { ok: false, code, message: 'denied' }; } };
}
function mkHooks() {
  const buf = bufferSink();
  return { hooks: { logger: new MeshLogger({ sink: buf.sink, level: 'debug' }), metrics: new MeshMetrics() }, buf };
}

describe('makeInboundDispatch', () => {
  it('runs verify before handler and emits rpc.in/rpc.out', async () => {
    const dedup = new CrossTransportDedup();
    const { hooks, buf } = mkHooks();
    const handler = vi.fn(async (r: MeshRequest): Promise<MeshResponse> => ({ id: r.id, status: 'ok' }));
    const dispatch = makeInboundDispatch({
      localScopeId: 'scp_b3_B' as ScopeId,
      verifier: okVerifier(),
      hooks,
      dedup,
      handler,
    });

    const r = await dispatch(mkReq(), { authenticatedScope: 'scp_b3_A' as ScopeId, peerId: 'p1' });
    expect(r.status).toBe('ok');
    expect(handler).toHaveBeenCalledTimes(1);
    const evNames = buf.events.map((e) => e.event);
    expect(evNames[0]).toBe('rpc.in');
    expect(evNames.at(-1)).toBe('rpc.out');
  });

  it('returns denied without invoking handler when verifier denies', async () => {
    const dedup = new CrossTransportDedup();
    const { hooks, buf } = mkHooks();
    const handler = vi.fn(async () => ({ id: 'x', status: 'ok' as const }));
    const dispatch = makeInboundDispatch({
      localScopeId: 'scp_b3_B' as ScopeId,
      verifier: denyVerifier('E_CAP_EXPIRED'),
      hooks,
      dedup,
      handler,
    });

    const r = await dispatch(mkReq(), { authenticatedScope: 'scp_b3_A' as ScopeId });
    expect(r.status).toBe('denied');
    expect(r.error?.code).toBe('E_CAP_EXPIRED');
    expect(handler).not.toHaveBeenCalled();
    expect(buf.events.some((e) => e.event === 'rpc.denied')).toBe(true);
  });

  it('serves cached response on dedup hit without re-running handler', async () => {
    const dedup = new CrossTransportDedup();
    const handler = vi.fn(async (r: MeshRequest): Promise<MeshResponse> => ({ id: r.id, status: 'ok', payload: new Uint8Array([0xee]) }));
    const dispatch = makeInboundDispatch({
      localScopeId: 'scp_b3_B' as ScopeId,
      verifier: okVerifier(),
      dedup,
      handler,
    });

    const req = mkReq();
    const r1 = await dispatch(req, { authenticatedScope: 'scp_b3_A' as ScopeId });
    const r2 = await dispatch(req, { authenticatedScope: 'scp_b3_A' as ScopeId });
    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not log raw payload bytes', async () => {
    const dedup = new CrossTransportDedup();
    const { hooks, buf } = mkHooks();
    const handler = async (r: MeshRequest): Promise<MeshResponse> => ({ id: r.id, status: 'ok' });
    const dispatch = makeInboundDispatch({
      localScopeId: 'scp_b3_B' as ScopeId,
      verifier: okVerifier(),
      hooks,
      dedup,
      handler,
    });
    await dispatch(mkReq(), { authenticatedScope: 'scp_b3_A' as ScopeId });
    const joined = buf.lines.join('\n');
    expect(joined).not.toContain('"payload"');
    expect(joined).not.toContain('"capability"');
  });
});
