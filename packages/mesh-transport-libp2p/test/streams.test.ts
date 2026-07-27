import { describe, it, expect } from "vitest";
import { Libp2pMeshTransport } from "../src/transport.js";
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from "@orqenix/mesh-transport-core";

function mkSeed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function mkReq(toScope: ScopeId, id = "01HV0R6X3M8YQ9G7F2D5W1KZJP"): MeshRequest {
  return {
    id,
    fromScope: "scp_b3_aa" as ScopeId,
    toScope,
    capability: "cap_test" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + 3000,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
}

describe("Libp2pMeshTransport streams", () => {
  it("A -> B over /orqenix/mesh/1.0.0 returns ok with payload", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
    });
    B.onRequest(async (r) => ({
      id: r.id,
      status: "ok",
      payload: new Uint8Array([...r.payload, 0xee]),
    }));

    await A.start();
    await B.start();

    const addrs = B.multiaddrs();
    expect(addrs.length).toBeGreaterThan(0);

    const addr: MeshAddress = { kind: "libp2p", multiaddr: addrs[0] };
    const resp = await A.send(addr, mkReq("scp_b3_bb" as ScopeId));
    expect(resp.status).toBe("ok");
    expect(resp.payload?.at(-1)).toBe(0xee);

    await A.stop();
    await B.stop();
  }, 15_000);
});
