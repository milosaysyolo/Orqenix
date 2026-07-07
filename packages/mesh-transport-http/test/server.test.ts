// packages/mesh-transport-http/test/server.test.ts
import { describe, it, expect } from "vitest";
import { HttpMeshTransport } from "../src/transport.js";
import { NoopIdentityVerifier, NoopSigner } from "../src/identity.js";
import { buildHeaders, CONTENT_TYPE } from "../src/headers.js";
import {
  encodeRequest,
  decodeResponse,
  type CapabilityToken,
  type MeshRequest,
  type ScopeId,
} from "@orqenix/mesh-transport-core";
import { request as undiciRequest } from "undici";

function mkReq(id = "01HV0R6X3M8YQ9G7F2D5W1KZJP"): MeshRequest {
  return {
    id,
    fromScope: "scp_b3_A" as ScopeId,
    toScope: "scp_b3_B" as ScopeId,
    capability: "cap_test" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + 2000,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
}

class NullVerifier {
  async verifyScopeSig(): Promise<boolean> {
    return false;
  }
}

describe("HttpMeshTransport (server)", () => {
  it("start/stop is clean", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    await s.start();
    await s.stop();
    await s.stop();
    expect(s.peers()).toEqual([]);
  });

  it("serves a valid POST and returns ok", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    s.onRequest(async (r) => ({
      id: r.id,
      status: "ok",
      payload: new Uint8Array([...r.payload, 0xff]),
    }));
    await s.start();
    const url = `http://127.0.0.1:${s.port()}/orqenix/mesh/v1/rpc`;
    const req = mkReq();
    const r = await undiciRequest(url, {
      method: "POST",
      headers: { ...buildHeaders(req, "sig"), "content-type": CONTENT_TYPE },
      body: Buffer.from(encodeRequest(req)),
    });
    expect(r.statusCode).toBe(200);
    const buf = Buffer.from(await r.body.arrayBuffer());
    const resp = decodeResponse(new Uint8Array(buf));
    expect(resp.status).toBe("ok");
    expect(resp.payload?.at(-1)).toBe(0xff);
    await s.stop();
  });

  it("404 on wrong path", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    await s.start();
    const r = await undiciRequest(`http://127.0.0.1:${s.port()}/nope`, { method: "GET" });
    expect(r.statusCode).toBe(404);
    await s.stop();
  });

  it("dedup returns cached on duplicate id (409)", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    let calls = 0;
    s.onRequest(async (r) => {
      calls++;
      return { id: r.id, status: "ok" };
    });
    await s.start();
    const url = `http://127.0.0.1:${s.port()}/orqenix/mesh/v1/rpc`;
    const req = mkReq("01HV0R6X3M8YQ9G7F2D5W1KZJQ");
    const headers = { ...buildHeaders(req, "sig"), "content-type": CONTENT_TYPE };
    const body = Buffer.from(encodeRequest(req));
    const r1 = await undiciRequest(url, { method: "POST", headers, body });
    await r1.body.arrayBuffer();
    const r2 = await undiciRequest(url, { method: "POST", headers, body });
    await r2.body.arrayBuffer();
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(409);
    expect(calls).toBe(1);
    await s.stop();
  });

  it("handler throwing maps to error", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    s.onRequest(async (r) => {
      throw new Error("handler oops");
    });
    await s.start();
    const req = mkReq();
    const r = await undiciRequest(`http://127.0.0.1:${s.port()}/orqenix/mesh/v1/rpc`, {
      method: "POST",
      headers: { ...buildHeaders(req, "sig"), "content-type": CONTENT_TYPE },
      body: Buffer.from(encodeRequest(req)),
    });
    expect(r.statusCode).toBe(500);
    await s.stop();
  });

  it("identity verification failure maps to 403 denied", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NullVerifier() as any,
      sign: NoopSigner,
    });
    s.onRequest(async (r) => ({ id: r.id, status: "ok" }));
    await s.start();
    const req = mkReq();
    const r = await undiciRequest(`http://127.0.0.1:${s.port()}/orqenix/mesh/v1/rpc`, {
      method: "POST",
      headers: { ...buildHeaders(req, "sig"), "content-type": CONTENT_TYPE },
      body: Buffer.from(encodeRequest(req)),
    });
    expect(r.statusCode).toBe(403);
    await s.stop();
  });
});
