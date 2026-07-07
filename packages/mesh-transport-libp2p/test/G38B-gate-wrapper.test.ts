import {
  Libp2pMeshTransport,
  PROTOCOL_ID,
  isSupportedProtocol,
  supportedProtocols,
  derivePeerFromScope,
  scopeIdToSaltBytes,
  Dialer,
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

function pickTcpAddr(addrs: string[]): string {
  const a = addrs.find((x) => /\/tcp\/\d+(\/p2p\/|$)/.test(x) && !/\/ws\//.test(x));
  if (!a) throw new Error("no tcp addr");
  return a;
}

describe("G38B libp2p adapters gate criteria", () => {
  // ---- C1: HKDF derivation deterministic ----
  it("C1 HKDF deterministic peer id", async () => {
    const salt = scopeIdToSaltBytes("scp_b3_aa" as ScopeId);
    const a = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    const b = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    expect(a.peerId.toString()).toBe(b.peerId.toString());
  });

  // ---- C2: peer_id stable across two TCP transports with same seed ----
  it("C2 peer_id stable across restarts (TCP)", async () => {
    const t1 = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(5),
      adapters: ["tcp"],
    });
    const t2 = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(5),
      adapters: ["tcp"],
    });
    await t1.start();
    await t2.start();
    const p1 = pickTcpAddr(t1.multiaddrs()).split("/p2p/")[1] ?? "";
    const p2 = pickTcpAddr(t2.multiaddrs()).split("/p2p/")[1] ?? "";
    expect(p1.length).toBeGreaterThan(0);
    expect(p1).toBe(p2);
    await t1.stop();
    await t2.stop();
  }, 20_000);

  // ---- C3: protocol identifier exactly /orqenix/mesh/1.0.0 ----
  it("C3 protocol id locked", () => {
    expect(PROTOCOL_ID).toBe("/orqenix/mesh/1.0.0");
    expect(isSupportedProtocol("/orqenix/mesh/1.0.0")).toBe(true);
    expect(isSupportedProtocol("/orqenix/mesh/1.0.1")).toBe(false);
    expect(isSupportedProtocol("/orqenix/mesh/2.0.0")).toBe(false);
    expect(supportedProtocols()).toHaveLength(1);
  });

  // ---- C4: A -> B over TCP returns ok ----
  it("C4 A -> B over TCP ok", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ["tcp"],
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ["tcp"],
    });
    B.onRequest(async (r) => ({
      id: r.id,
      status: "ok",
      payload: new Uint8Array([...r.payload, 0xee]),
    }));
    await A.start();
    await B.start();
    const tcpAddr = pickTcpAddr(B.multiaddrs());
    const addr: MeshAddress = { kind: "libp2p", multiaddr: tcpAddr };
    const resp = await A.send(addr, mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB04"));
    expect(resp.status).toBe("ok");
    expect(resp.payload?.at(-1)).toBe(0xee);
    await A.stop();
    await B.stop();
  }, 20_000);

  // ---- C5: rejected handshake -> denied, no handler call ----
  it("C5 rejected handshake -> denied + no handler (TCP)", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ["tcp"],
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ["tcp"],
      verifier: new AlwaysFalseVerifier(),
    });
    let handlerCalls = 0;
    B.onRequest(async (r) => {
      handlerCalls++;
      return { id: r.id, status: "ok" };
    });
    await A.start();
    await B.start();
    const tcpAddr = pickTcpAddr(B.multiaddrs());
    const resp = await A.send(
      { kind: "libp2p", multiaddr: tcpAddr },
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB05"),
    );
    expect(handlerCalls).toBe(0);
    expect(["denied", "error"]).toContain(resp.status);
    await A.stop();
    await B.stop();
  }, 20_000);

  // ---- C6: clean teardown over TCP; peers() empty ----
  it("C6 lifecycle clean teardown (TCP)", async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(3),
      adapters: ["tcp"],
    });
    await t.start();
    await t.start();
    await t.stop();
    await t.stop();
    expect(t.peers()).toEqual([]);
  }, 10_000);

  // ---- C7: send() before start rejected by state machine ----
  it("C7 send before start rejected by state machine", async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(4),
      adapters: ["tcp"],
    });
    await expect(
      t.send(
        {
          kind: "libp2p",
          multiaddr: "/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha",
        },
        mkReq("scp_b3_zz" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB07"),
      ),
    ).rejects.toThrow();
  });

  // ---- C8: deadline honored on slow handler -> timeout ----
  it("C8 deadline honored -> timeout (TCP)", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ["tcp"],
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ["tcp"],
    });
    B.onRequest(async (r) => {
      await new Promise((res) => setTimeout(res, 300));
      return { id: r.id, status: "ok" };
    });
    await A.start();
    await B.start();
    const tcpAddr = pickTcpAddr(B.multiaddrs());
    const resp = await A.send(
      { kind: "libp2p", multiaddr: tcpAddr },
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB08", Date.now() + 80),
    );
    expect(resp.status).toBe("timeout");
    await A.stop();
    await B.stop();
  }, 20_000);

  // ---- B1: adapter selection binds tcp and ws ----
  it("B1 adapter selection binds tcp and ws", async () => {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_cc" as ScopeId,
      scopeSeed: mkSeed(8),
      adapters: ["tcp", "websockets"],
    });
    await t.start();
    const addrs = t.multiaddrs();
    const hasTcp = addrs.some((a) => /\/tcp\/\d+(\/p2p\/|$)/.test(a) && !/\/ws\//.test(a));
    const hasWs = addrs.some((a) => /\/ws\//.test(a));
    expect(hasTcp).toBe(true);
    expect(hasWs).toBe(true);
    await t.stop();
  }, 15_000);

  // ---- B2: idle timeout closes connections with no traffic ----
  it("B2 idle timeout closes connections", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ["tcp"],
      idleConnectionTimeoutMs: 200,
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ["tcp"],
    });
    B.onRequest(async (r) => ({ id: r.id, status: "ok" }));
    await A.start();
    await B.start();
    const tcpAddr = pickTcpAddr(B.multiaddrs());
    await A.send(
      { kind: "libp2p", multiaddr: tcpAddr },
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB10"),
    );
    const before = A.connectionCount();
    await new Promise((res) => setTimeout(res, 700));
    const after = A.connectionCount();
    expect(before).toBeGreaterThanOrEqual(1);
    expect(after).toBeLessThan(before);
    await A.stop();
    await B.stop();
  }, 15_000);

  // ---- B3: dial backoff retries on transient failure, then succeeds ----
  it("B3 dial backoff retries then succeeds", async () => {
    let attempts = 0;
    const node = {
      dial: async () => {
        attempts++;
        if (attempts < 3) throw new Error("refused");
        return { id: "conn", close: async () => {} };
      },
    };
    const d = new Dialer({
      backoff: { maxAttempts: 5, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} },
    });
    const conn = await d.dial(
      node as unknown as Parameters<typeof d.dial>[0],
      "/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha",
      { deadlineMs: Date.now() + 1000 },
    );
    expect(conn).toBeDefined();
    expect(attempts).toBe(3);
  });

  // ---- B4: drain on stop releases all sockets ----
  it("B4 drain on stop releases sockets", async () => {
    const A = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(1),
      adapters: ["tcp"],
      stopGracePeriodMs: 300,
    });
    const B = new Libp2pMeshTransport({
      localScopeId: "scp_b3_bb" as ScopeId,
      scopeSeed: mkSeed(2),
      adapters: ["tcp"],
    });
    B.onRequest(async (r) => ({ id: r.id, status: "ok" }));
    await A.start();
    await B.start();
    const tcpAddr = pickTcpAddr(B.multiaddrs());
    await A.send(
      { kind: "libp2p", multiaddr: tcpAddr },
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZB12"),
    );
    await A.stop();
    await B.stop();
    expect(A.peers()).toEqual([]);
    expect(B.peers()).toEqual([]);
  }, 20_000);
});
