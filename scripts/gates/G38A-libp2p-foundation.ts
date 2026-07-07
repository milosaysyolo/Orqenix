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
} from "../../packages/mesh-transport-libp2p/src/index.js";
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from "../../packages/mesh-transport-core/src/index.js";

let failures = 0;

function check(name: string, ok: boolean, detail = ""): void {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[G38A] ${tag}  ${name}${detail ? `  (${detail})` : ""}`);
}

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

async function main(): Promise<void> {
  // ---- C1: HKDF derivation is deterministic and stable ----
  {
    const salt = scopeIdToSaltBytes("scp_b3_aa" as ScopeId);
    const a = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    const b = await derivePeerFromScope({ scopeSeed: mkSeed(7), scopeIdBytes: salt });
    check("C1 HKDF deterministic peer id", a.peerId.toString() === b.peerId.toString());
  }

  // ---- C2: peer_id stable across two Libp2pMeshTransport instances ----
  {
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
    check("C2 peer_id stable across restarts", p1.length > 0 && p1 === p2);
    await t1.stop();
    await t2.stop();
  }

  // ---- C3: protocol identifier exactly /orqenix/mesh/1.0.0 ----
  {
    check(
      "C3 protocol id locked",
      PROTOCOL_ID === "/orqenix/mesh/1.0.0" &&
        isSupportedProtocol("/orqenix/mesh/1.0.0") &&
        !isSupportedProtocol("/orqenix/mesh/1.0.1") &&
        !isSupportedProtocol("/orqenix/mesh/2.0.0") &&
        supportedProtocols().length === 1,
    );
  }

  // ---- C4: successful Noise + handshake + RPC round-trip A -> B ----
  {
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
    check("C4 A -> B over libp2p ok", resp.status === "ok" && resp.payload?.at(-1) === 0xee);
    await A.stop();
    await B.stop();
  }

  // ---- C5: rejected capability handshake yields denied, no handler invocation ----
  {
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
    check(
      "C5 rejected handshake -> no handler + error/denied",
      handlerCalls === 0 && (resp.status === "denied" || resp.status === "error"),
      `status=${resp.status}, handlerCalls=${handlerCalls}`,
    );
    await A.stop();
    await B.stop();
  }

  // ---- C6: lifecycle clean teardown; peers() empty after stop ----
  {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(3),
    });
    await t.start();
    await t.start();
    await t.stop();
    await t.stop();
    check("C6 lifecycle clean teardown", t.peers().length === 0);
  }

  // ---- C7: send() before start throws via lifecycle assertion (illegal state) ----
  {
    const t = new Libp2pMeshTransport({
      localScopeId: "scp_b3_aa" as ScopeId,
      scopeSeed: mkSeed(4),
    });
    let threw = false;
    try {
      await t.send(
        { kind: "libp2p", multiaddr: "/memory/none" },
        mkReq("scp_b3_zz" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA07"),
      );
    } catch {
      threw = true;
    }
    check("C7 send before start rejected by state machine", threw);
  }

  // ---- C8: deadline honored; expired request returns timeout ----
  {
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
      mkReq("scp_b3_bb" as ScopeId, "01HV0R6X3M8YQ9G7F2D5W1ZA08", Date.now() + 80),
    );
    check("C8 deadline honored -> timeout", resp.status === "timeout", `status=${resp.status}`);
    await A.stop();
    await B.stop();
  }

  void NoopIdentityVerifier;
  void NoopSigner;

  if (failures > 0) {
    console.error(`[G38A] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log("[G38A] ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
