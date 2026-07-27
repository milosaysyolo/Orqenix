import { describe, it, expect, vi } from "vitest";
import { MeshRouter } from "../src/router.js";
import { DEFAULT_PRIORITY } from "../src/priority.js";
import { CircuitBreaker } from "../src/circuit-breaker.js";
import { CrossTransportDedup } from "../src/dedup.js";
import type {
  MeshAddress,
  MeshRequest,
  MeshResponse,
  MeshStatus,
  MeshTransport,
  ScopeId,
  TransportRegistry,
} from "@orqenix/mesh-transport-core";
import type { StructuralCapabilityVerifier } from "../src/inbound.js";
import { MeshLogger, MeshMetrics, bufferSink } from "@orqenix/mesh-observability";

function makeFakeTransport(
  kind: string,
  statuses: MeshStatus[],
  delays?: number[],
): MeshTransport & { calls: number } {
  let i = 0;
  const t = {
    kind,
    localScopeId: "scp_b3_A" as ScopeId,
    calls: 0,
    async start() {},
    async stop() {},
    async send(_addr: MeshAddress, req: MeshRequest): Promise<MeshResponse> {
      const ix = Math.min(i++, statuses.length - 1);
      if (delays && delays[ix]) await new Promise((res) => setTimeout(res, delays[ix]));
      this.calls++;
      const s = statuses[ix];
      return {
        id: req.id,
        status: s,
        error: s === "denied" ? { code: "E_CAP_EXPIRED", message: "x" } : undefined,
      } as MeshResponse;
    },
    onRequest() {},
    peers() {
      return [];
    },
  };
  return t as unknown as MeshTransport & { calls: number };
}

function makeRegistry(transports: MeshTransport[]): TransportRegistry {
  return {
    register(_t) {},
    unregister(_k) {},
    get(kind) {
      return transports.find((t) => t.kind === kind);
    },
    all() {
      return transports.slice();
    },
    reachable(_id) {
      return transports.slice();
    },
  } as unknown as TransportRegistry;
}

function mkReq(deadlineDeltaMs = 1000): MeshRequest {
  return {
    id: "01HV0R6X3M8YQ9G7F2D5W1RTR01",
    fromScope: "scp_b3_A" as ScopeId,
    toScope: "scp_b3_B" as ScopeId,
    capability: "cap_test" as unknown as any,
    method: "memory.query",
    payload: new Uint8Array([1]),
    deadlineMs: Date.now() + deadlineDeltaMs,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  } as unknown as MeshRequest;
}

function okVerifier(): StructuralCapabilityVerifier {
  return {
    async verify() {
      return { ok: true, token: {} };
    },
  };
}

function addrFor(kind: string): MeshAddress {
  if (kind === "http")
    return { kind: "http", baseUrl: "http://127.0.0.1:1" } as unknown as MeshAddress;
  if (kind === "libp2p")
    return { kind: "libp2p", multiaddr: "/ip4/127.0.0.1/tcp/1" } as unknown as MeshAddress;
  return { kind: "http", baseUrl: "http://127.0.0.1:1" } as unknown as MeshAddress;
}

describe("MeshRouter outbound", () => {
  it("returns ok from the priority-first transport on success", async () => {
    const l = makeFakeTransport("libp2p", ["ok"]);
    const h = makeFakeTransport("http", ["ok"]);
    const reg = makeRegistry([h, l]);
    const router = new MeshRouter({
      localScopeId: "scp_b3_A" as ScopeId,
      registry: reg,
      verifier: okVerifier(),
      addressResolver: (kind) => addrFor(kind),
      priority: DEFAULT_PRIORITY,
    });
    const r = await router.send(mkReq());
    expect(r.status).toBe("ok");
    expect(l.calls).toBe(1);
    expect(h.calls).toBe(0);
  });

  it("fails over from libp2p timeout to http within deadline", async () => {
    const l = makeFakeTransport("libp2p", ["timeout"]);
    const h = makeFakeTransport("http", ["ok"]);
    const reg = makeRegistry([l, h]);
    const { sink, events } = bufferSink();
    const hooks = { logger: new MeshLogger({ sink, level: "debug" }), metrics: new MeshMetrics() };
    const router = new MeshRouter({
      localScopeId: "scp_b3_A" as ScopeId,
      registry: reg,
      verifier: okVerifier(),
      addressResolver: (kind) => addrFor(kind),
      priority: DEFAULT_PRIORITY,
      hooks,
    });
    const r = await router.send(mkReq(500));
    expect(r.status).toBe("ok");
    expect(l.calls).toBe(1);
    expect(h.calls).toBe(1);
    expect(events.some((e) => e.event === "failover")).toBe(true);
  });

  it("returns denied immediately without failover", async () => {
    const l = makeFakeTransport("libp2p", ["denied"]);
    const h = makeFakeTransport("http", ["ok"]);
    const reg = makeRegistry([l, h]);
    const router = new MeshRouter({
      localScopeId: "scp_b3_A" as ScopeId,
      registry: reg,
      verifier: okVerifier(),
      addressResolver: (kind) => addrFor(kind),
      priority: DEFAULT_PRIORITY,
    });
    const r = await router.send(mkReq());
    expect(r.status).toBe("denied");
    expect(l.calls).toBe(1);
    expect(h.calls).toBe(0);
  });

  it("opens the breaker after threshold failures and refuses further sends", async () => {
    const l = makeFakeTransport("libp2p", ["timeout", "timeout", "timeout", "ok"]);
    const h = makeFakeTransport("http", ["error", "error", "error", "ok"]);
    const reg = makeRegistry([l, h]);
    const router = new MeshRouter({
      localScopeId: "scp_b3_A" as ScopeId,
      registry: reg,
      verifier: okVerifier(),
      addressResolver: (kind) => addrFor(kind),
      priority: DEFAULT_PRIORITY,
      breaker: new CircuitBreaker({ failureThreshold: 2, cooldownMs: 60_000 }),
    });
    await router.send(mkReq());
    await router.send(mkReq());
    expect(router.breakerStateOf("libp2p")).toBe("Open");
    expect(router.breakerStateOf("http")).toBe("Open");

    const final = await router.send(mkReq());
    expect(["timeout", "error", "denied"]).toContain(final.status);
  });

  it("returns error when no transports are reachable", async () => {
    const router = new MeshRouter({
      localScopeId: "scp_b3_A" as ScopeId,
      registry: makeRegistry([]),
      verifier: okVerifier(),
      addressResolver: () => undefined,
    });
    const r = await router.send(mkReq());
    expect(r.status).toBe("error");
  });
});
