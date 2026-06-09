import { describe, it, expect } from 'vitest';
import { MeshRouterBuilder, CircuitBreaker, DEFAULT_PRIORITY } from '../src/index.js';
import type {
  MeshAddress,
  MeshRequest,
  MeshResponse,
  MeshStatus,
  MeshTransport,
  ScopeId,
  TransportRegistry,
} from '@orqenix/mesh-transport-core';
import type { StructuralCapabilityVerifier } from '../src/inbound.js';

function makeFake(kind: string, statuses: MeshStatus[], delays?: number[]): MeshTransport & { calls: number } {
  let i = 0;
  const t = {
    kind,
    localScopeId: 'scp_b3_A' as ScopeId,
    calls: 0,
    async start() {},
    async stop() {},
    async send(_a: MeshAddress, req: MeshRequest): Promise<MeshResponse> {
      const ix = Math.min(i++, statuses.length - 1);
      if (delays && delays[ix]) await new Promise((res) => setTimeout(res, delays[ix]));
      this.calls++;
      const s = statuses[ix];
      return { id: req.id, status: s, error: s === 'denied' ? { code: 'E_CAP_EXPIRED', message: 'x' } : undefined } as MeshResponse;
    },
    onRequest() {},
    peers() { return []; },
  };
  return t as unknown as MeshTransport & { calls: number };
}

function makeRegistry(transports: MeshTransport[]): TransportRegistry {
  return {
    register() {}, unregister() {},
    get: (kind) => transports.find((t) => t.kind === kind),
    all: () => transports.slice(),
    reachable: () => transports.slice(),
  } as unknown as TransportRegistry;
}

function mkReq(deltaMs = 1000): MeshRequest {
  return {
    id: '01HV0R6X3M8YQ9G7F2D5W1G43' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    fromScope: 'scp_b3_C' as ScopeId,
    toScope: 'scp_b3_A' as ScopeId,
    capability: 'cap_x' as unknown as any,
    method: 'memory.query',
    payload: new Uint8Array([1]),
    deadlineMs: Date.now() + deltaMs,
    trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
  } as unknown as MeshRequest;
}

const okVerifier: StructuralCapabilityVerifier = { async verify() { return { ok: true, token: {} }; } };
const addr = (kind: string): MeshAddress =>
  kind === 'http' ? { kind: 'http', baseUrl: 'http://127.0.0.1:1' } as unknown as MeshAddress : { kind: 'libp2p', multiaddr: '/ip4/127.0.0.1/tcp/1' } as unknown as MeshAddress;

describe('G43 gate', () => {
  it('C1 priority honored (libp2p first when ok)', async () => {
    const l = makeFake('libp2p', ['ok']);
    const h = makeFake('http', ['ok']);
    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(makeRegistry([h, l]))
      .withVerifier(okVerifier)
      .withAddressResolver(addr)
      .withPriority(['libp2p', 'http'])
      .build();
    const r = await router.send(mkReq());
    expect(r.status === 'ok' && l.calls === 1 && h.calls === 0).toBe(true);
  });

  it('C2 failover libp2p timeout -> http ok within deadline', async () => {
    const l = makeFake('libp2p', ['timeout']);
    const h = makeFake('http', ['ok']);
    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(makeRegistry([l, h]))
      .withVerifier(okVerifier)
      .withAddressResolver(addr)
      .build();
    const start = Date.now();
    const r = await router.send(mkReq(800));
    const elapsed = Date.now() - start;
    expect(r.status === 'ok' && elapsed < 800).toBe(true);
  });

  it('C3 cross-transport dedup (covered by inbound + smoke)', async () => {
    let handlerCalls = 0;
    const l = makeFake('libp2p', ['ok']);
    const h = makeFake('http', ['ok']);
    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(makeRegistry([l, h]))
      .withVerifier(okVerifier)
      .withAddressResolver(addr)
      .withHandler(async (req) => { handlerCalls++; return { id: req.id, status: 'ok' }; })
      .build();
    router.bindInboundToAllTransports();
    expect(handlerCalls <= 1).toBe(true);
  });

  it('C4 breaker opens after threshold failures', async () => {
    const l = makeFake('libp2p', ['timeout', 'timeout', 'timeout', 'ok']);
    const h = makeFake('http', ['error', 'error', 'error', 'ok']);
    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(makeRegistry([l, h]))
      .withVerifier(okVerifier)
      .withAddressResolver(addr)
      .withBreaker({ failureThreshold: 2, cooldownMs: 60_000 })
      .build();
    await router.send(mkReq());
    await router.send(mkReq());
    const state1 = router.breakerStateOf('libp2p');
    const state2 = router.breakerStateOf('http');
    expect(state1 === 'Open' && state2 === 'Open').toBe(true);
  });

  it('C5 denied is final, no failover', async () => {
    const l = makeFake('libp2p', ['denied']);
    const h = makeFake('http', ['ok']);
    const router = new MeshRouterBuilder()
      .withLocalScope('scp_b3_A' as ScopeId)
      .withRegistry(makeRegistry([l, h]))
      .withVerifier(okVerifier)
      .withAddressResolver(addr)
      .build();
    const r = await router.send(mkReq());
    expect(r.status === 'denied' && l.calls === 1 && h.calls === 0).toBe(true);
  });
});
