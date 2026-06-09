import { describe, it, expect, vi } from 'vitest';
import { MeshRouterBuilder } from '../src/builder.js';
import type {
  MeshAddress,
  MeshRequest,
  MeshResponse,
  MeshTransport,
  ScopeId,
  TransportRegistry,
} from '@orqenix/mesh-transport-core';
import type { StructuralCapabilityVerifier } from '../src/inbound.js';
import { MeshLogger, MeshMetrics, bufferSink } from '@orqenix/mesh-observability';

function makeFakeTransport(kind: string, behavior: (req: MeshRequest) => Promise<MeshResponse>): MeshTransport {
  let registered: ((req: MeshRequest, ctx: { authenticatedScope: ScopeId; peerId?: string; remoteAddr?: string }) => Promise<MeshResponse>) | undefined;
  return {
    kind,
    localScopeId: 'scp_b3_A' as ScopeId,
    async start() {},
    async stop() {},
    async send(_a: any, req: MeshRequest) { return behavior(req); },
    onRequest(h: any) { registered = h; },
    peers() { return []; },
    _dispatch: (req: MeshRequest) => registered?.(req, { authenticatedScope: req.fromScope, peerId: 'test', remoteAddr: 'inproc' }),
  } as unknown as MeshTransport;
}

function makeRegistry(transports: MeshTransport[]): TransportRegistry {
  return {
    register() {},
    unregister() {},
    get(kind) { return transports.find((t) => t.kind === kind); },
    all() { return transports.slice(); },
    reachable() { return transports.slice(); },
  } as unknown as TransportRegistry;
}

function mkReq(): MeshRequest {
  return {
    id: '01HV0R6X3M8YQ9G7F2D5W1SMKEND',
    fromScope: 'scp_b3_C' as ScopeId,
    toScope: 'scp_b3_A' as ScopeId,
    capability: 'cap_smoke' as unknown as any,
    method: 'memory.query',
    payload: new Uint8Array([0x10, 0x20]),
    deadlineMs: Date.now() + 2000,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  } as unknown as MeshRequest;
}

describe('Part 9 smoke: failover libp2p -> http with dedup integrity', () => {
  it('libp2p times out, http succeeds, handler invoked exactly once via dedup', async () => {
    const l2p = makeFakeTransport('libp2p', async (req) => ({ id: req.id, status: 'timeout' }));
    const http = makeFakeTransport('http', async (req) => ({ id: req.id, status: 'ok', payload: new Uint8Array([0xee]) }));
    const reg = makeRegistry([l2p, http]);

    const { sink, events, lines } = bufferSink();
    const hooks = { logger: new MeshLogger({ sink, level: 'debug' }), metrics: new MeshMetrics() };

    const okVerifier: StructuralCapabilityVerifier = { async verify() { return { ok: true, token: {} }; } };

    const handlerCalls = vi.fn(async (req: MeshRequest): Promise<MeshResponse> => ({
      id: req.id, status: 'ok', payload: new Uint8Array([0xee]),
    }));

    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(reg)
      .withVerifier(okVerifier)
      .withAddressResolver((kind) => kind === 'http'
        ? { kind: 'http', baseUrl: 'http://127.0.0.1:1' } as unknown as MeshAddress
        : { kind: 'libp2p', multiaddr: '/ip4/127.0.0.1/tcp/1' } as unknown as MeshAddress)
      .withHooks(hooks)
      .withHandler(handlerCalls)
      .build();

    const out = await router.send(mkReq());
    expect(out.status).toBe('ok');
    expect(out.payload?.at(-1)).toBe(0xee);

    const inboundReq = mkReq();

    const r1 = await (l2p as unknown as { _dispatch: any })._dispatch(inboundReq);
    const r2 = await (http as unknown as { _dispatch: any })._dispatch(inboundReq);

    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    expect(handlerCalls).toHaveBeenCalledTimes(1);

    const evNames = events.map((e) => e.event);
    expect(evNames).toContain('failover');
    expect(evNames).toContain('rpc.in');
    expect(evNames).toContain('rpc.out');
    expect(lines.join('\n')).not.toContain('"payload":"');
  });
});
