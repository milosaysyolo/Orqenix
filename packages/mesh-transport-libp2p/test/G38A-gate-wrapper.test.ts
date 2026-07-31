import {
  Libp2pMeshTransport,
  PROTOCOL_ID,
  isSupportedProtocol,
  supportedProtocols,
  derivePeerFromScope,
  scopeIdToSaltBytes,
  NoopIdentityVerifier,
  NoopSigner,
  type IdentityVerifier,
} from "../src/index.js";
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from "@orqenix/mesh-transport-core";
import { describe, it, expect } from "vitest";

function mkSeed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function mkReq(toScope: ScopeId, id: string, deadlineMs = Date.now() + 3000): MeshRequest {
  return {
    id,
    fromScope: "scp_b3_aa" as ScopeId,
    toScope,
    capability: "cap_test" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
}

class AlwaysFalseVerifier implements IdentityVerifier {
  async verifyScopeSig(): Promise<boolean> {
    return false;
  }
}

describe("G38A libp2p foundation gate criteria", () => {
  it("C1 HKDF deterministic peer id", async () => {
    const salt = scopeIdToSaltBytes("scp_b3_aa" as ScopeId);
    const a = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    const b = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    expect(a.peerId.toString()).toBe(b.peerId.toString());
  });

  it("C2 peer_id stable across restarts", async () => {
    const t1 = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(5),
    });
    const t2 = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(5),
    });
    await t1.start();
    await t2.start();
    const p1 = (t1.multiaddrs()[0] ?? "").split("/p2p/")[1] ?? "";
    const p2 = (t2.multiaddrs()[0] ?? "").split("/p2p/")[1] ?? "";
    expect(p1.length).toBeGreaterThan(0);
    expect(p1).toBe(p2);
    await t1.stop();
    await t2.stop();
  }, 20_000);

  it("C3 protocol id locked", () => {
    expect(PROTOCOL_ID).toBe("/orqenix/mesh/1.0.0");
    expect(isSupportedProtocol("/orqenix/mesh/1.0.0")).toBe(true);
    expect(isSupportedProtocol("/orqenix/mesh/1.0.1")).toBe(false);
    expect(isSupportedProtocol("/orqenix/mesh/2.0.0")).toBe(false);
    expect(supportedProtocols()).toHaveLength(1);
  });

  it("C4 A -> B over libp2p ok", async () => {
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
    const addr: MeshAddress = { kind: "libp2p", multiaddr: B.multiaddrs()[0] };
    const resp = await A.send(addr, mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA01"));
    expect(resp.status).toBe("ok");
    expect(resp.payload?.at(-1)).toBe(0xee);
    await A.stop();
    await B.stop();
  }, 20_000);

  it("C5 rejected handshake -> denied + no handler", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      verifier: new AlwaysFalseVerifier(),
    });
    let handlerCalls = 0;
    B.onRequest(async (r) => {
      handlerCalls++;
      return { id: r.id, status: "ok" };
    });
    await A.start();
    await B.start();
    const addr: MeshAddress = { kind: "libp2p", multiaddr: B.multiaddrs()[0] };
    const resp = await A.send(addr, mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA05"));
    expect(handlerCalls).toBe(0);
    expect(["denied", "error"]).toContain(resp.status);
    await A.stop();
    await B.stop();
  }, 20_000);

  it("C6 lifecycle clean teardown", async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(3),
    });
    await t.start();
    await t.start();
    await t.stop();
    await t.stop();
    expect(t.peers()).toEqual([]);
  }, 10_000);

  it("C7 send before start rejected by state machine", async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(4),
    });
    await expect(
      t.send(
        { kind: "libp2p", multiaddr: "/memory/none" },
        mkReq("scp_b3_zz" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA07"),
      ),
    ).rejects.toThrow();
  });

  it("C8 deadline honored -> timeout", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
    });
    B.onRequest(async (r) => {
      await new Promise((res) => setTimeout(res, 300));
      return { id: r.id, status: "ok" };
    });
    await A.start();
    await B.start();
    const addr: MeshAddress = { kind: "libp2p", multiaddr: B.multiaddrs()[0] };
    const resp = await A.send(
      addr,
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA08", Date.now() + 250),
    );
    expect(resp.status).toBe("timeout");
    await A.stop();
    await B.stop();
  }, 20_000);
});

void NoopIdentityVerifier;
void NoopSigner;
