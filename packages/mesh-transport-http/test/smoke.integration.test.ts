// packages/mesh-transport-http/test/smoke.integration.test.ts
import { describe, it, expect } from "vitest";
import { HttpMeshTransport } from "../src/transport.js";
import { NoopIdentityVerifier, NoopSigner } from "../src/identity.js";
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from "@orqenix/mesh-transport-core";

describe("Part 2 smoke: HTTP transport end-to-end", () => {
  it("A -> B over HTTP returns ok with payload, dedup single handler call, clean teardown", async () => {
    const server = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    let calls = 0;
    server.onRequest(async (r) => {
      calls++;
      return { id: r.id, status: "ok", payload: new Uint8Array([...r.payload, 0xee]) };
    });
    await server.start();

    const client = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    await client.start();

    const req: MeshRequest = {
      id: "01HV0R6X3M8YQ9G7F2D5W1KSMOKE",
      fromScope: "scp_b3_A" as ScopeId,
      toScope: "scp_b3_B" as ScopeId,
      capability: "cap_smoke" as CapabilityToken,
      method: "memory.query",
      payload: new Uint8Array([0x10, 0x20]),
      deadlineMs: Date.now() + 2000,
      trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
    };
    const addr: MeshAddress = { kind: "http", baseUrl: `http://127.0.0.1:${server.port()}` };

    const r1 = await client.send(addr, req);
    const r2 = await client.send(addr, req); // duplicate id
    expect(r1.status).toBe("ok");
    expect(r2.status).toBe("ok");
    expect(r1.payload?.at(-1)).toBe(0xee);
    expect(calls).toBe(1);

    await client.stop();
    await server.stop();
    expect(server.peers()).toEqual([]);
  });
});
