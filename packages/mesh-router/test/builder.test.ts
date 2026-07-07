import { describe, it, expect } from "vitest";
import { MeshRouterBuilder } from "../src/builder.js";
import type {
  MeshRequest,
  MeshResponse,
  MeshTransport,
  ScopeId,
  TransportRegistry,
} from "@orqenix/mesh-transport-core";
import type { StructuralCapabilityVerifier } from "../src/inbound.js";

function makeTransport(kind: string): MeshTransport & { handlerSet: boolean } {
  const t = {
    kind,
    localScopeId: "scp_b3_A" as ScopeId,
    handlerSet: false,
    async start() {},
    async stop() {},
    async send() {
      return { id: "x", status: "ok" as const };
    },
    onRequest() {
      (this as unknown as { handlerSet: boolean }).handlerSet = true;
    },
    peers() {
      return [];
    },
  };
  return t as unknown as MeshTransport & { handlerSet: boolean };
}

function makeRegistry(transports: MeshTransport[]): TransportRegistry {
  return {
    register() {},
    unregister() {},
    get(kind) {
      return transports.find((t) => t.kind === kind);
    },
    all() {
      return transports.slice();
    },
    reachable() {
      return transports.slice();
    },
  } as unknown as TransportRegistry;
}

function okVerifier(): StructuralCapabilityVerifier {
  return {
    async verify() {
      return { ok: true, token: {} };
    },
  };
}

const handler = async (r: MeshRequest): Promise<MeshResponse> => ({ id: r.id, status: "ok" });

describe("MeshRouterBuilder", () => {
  it("throws when required pieces are missing", () => {
    expect(() => new MeshRouterBuilder().build()).toThrow();
  });

  it("builds a router and binds the inbound handler to every transport", () => {
    const a = makeTransport("libp2p");
    const b = makeTransport("http");
    const router = new MeshRouterBuilder()
      .withLocalScope("scp_b3_A" as ScopeId)
      .withRegistry(makeRegistry([a, b]))
      .withVerifier(okVerifier())
      .withAddressResolver(() => ({ kind: "http", baseUrl: "http://127.0.0.1:1" }) as any)
      .withHandler(handler)
      .build();
    expect(router).toBeDefined();
    expect((a as unknown as { handlerSet: boolean }).handlerSet).toBe(true);
    expect((b as unknown as { handlerSet: boolean }).handlerSet).toBe(true);
  });

  it("honors custom priority and breaker options", () => {
    const a = makeTransport("libp2p");
    const b = makeTransport("http");
    const router = new MeshRouterBuilder()
      .withLocalScope("scp_b3_A" as ScopeId)
      .withRegistry(makeRegistry([a, b]))
      .withVerifier(okVerifier())
      .withAddressResolver(() => ({ kind: "http", baseUrl: "http://127.0.0.1:1" }) as any)
      .withPriority(["http", "libp2p"])
      .withBreaker({ failureThreshold: 5, cooldownMs: 1_000 })
      .build();
    expect(router.breakerStateOf("http")).toBe("Closed");
  });
});
