// packages/mesh-transport-http/test/client.test.ts
import { describe, it, expect } from "vitest";
import { HttpMeshTransport } from "../src/transport.js";
import { NoopIdentityVerifier, NoopSigner } from "../src/identity.js";
import { encodeResponse } from "@orqenix/mesh-transport-core";
import type { CapabilityToken, MeshRequest, ScopeId } from "@orqenix/mesh-transport-core";

function mkReq(toPort: number, id = "01HV0R6X3M8YQ9G7F2D5W1KZJC"): MeshRequest {
  return {
    id,
    fromScope: "scp_b3_A" as ScopeId,
    toScope: "scp_b3_B" as ScopeId,
    capability: "cap_test" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1]),
    deadlineMs: Date.now() + 1500,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
}

describe("HttpMeshTransport (client)", () => {
  it("maps 200 to ok", async () => {
    const s = new HttpMeshTransport({
      localScopeId: "scp_b3_B" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    s.onRequest(async (r) => ({ id: r.id, status: "ok", payload: new Uint8Array([42]) }));
    await s.start();
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${s.port()}` },
      mkReq(s.port()),
    );
    expect(resp.status).toBe("ok");
    expect(resp.payload?.[0]).toBe(42);
    await c.stop();
    await s.stop();
  });

  it("maps network failure to timeout after retries", async () => {
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 1,
      baseDelayMs: 1,
    });
    await c.start();
    const resp = await c.send({ kind: "http", baseUrl: "http://127.0.0.1:1" }, mkReq(1));
    expect(resp.status).toBe("timeout");
    await c.stop();
  });

  it("rejects non-http address", async () => {
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
    });
    await c.start();
    const resp = await c.send({ kind: "loopback", scopeId: "scp_b3_B" as ScopeId }, mkReq(0));
    expect(resp.status).toBe("error");
    await c.stop();
  });

  it("maps 403 to denied", async () => {
    const http = await import("node:http");
    const s = http.createServer((_req, res) => {
      res.writeHead(403, { "content-type": "application/vnd.orqenix.mesh+msgpack" });
      res.end(
        Buffer.from([
          0x83, 0xa2, 0x69, 0x64, 0xa1, 0x78, 0xa6, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0xa6, 0x64,
          0x65, 0x6e, 0x69, 0x65, 0x64,
        ]),
      );
    });
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
    const addr = s.address() as { port: number };
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 0,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${addr.port}` },
      mkReq(addr.port),
    );
    expect(resp.status).toBe("denied");
    await c.stop();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });

  it("maps 408 to timeout", async () => {
    const http = await import("node:http");
    const s = http.createServer((_req, res) => {
      res.writeHead(408, { "content-type": "application/vnd.orqenix.mesh+msgpack" });
      res.end(Buffer.from(encodeResponse({ id: "r", status: "timeout" })));
    });
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
    const addr = s.address() as { port: number };
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 1,
      baseDelayMs: 1,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${addr.port}` },
      mkReq(addr.port, "id408"),
    );
    expect(resp.status).toBe("timeout");
    await c.stop();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });

  it("maps 200 with bad body to fallback", async () => {
    const http = await import("node:http");
    const s = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/vnd.orqenix.mesh+msgpack" });
      res.end(Buffer.from([0xc0]));
    });
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
    const addr = s.address() as { port: number };
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 0,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${addr.port}` },
      mkReq(addr.port, "idBad200"),
    );
    expect(resp.status).toBe("error");
    await c.stop();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });

  it("maps unknown status to error", async () => {
    const http = await import("node:http");
    const s = http.createServer((_req, res) => {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("bad gateway");
    });
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
    const addr = s.address() as { port: number };
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 0,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${addr.port}` },
      mkReq(addr.port, "id502"),
    );
    expect(resp.status).toBe("error");
    await c.stop();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });

  it("maps 429 with retry-after to retry", async () => {
    let attempts = 0;
    const http = await import("node:http");
    const s = http.createServer((_req, res) => {
      attempts++;
      if (attempts === 1) {
        res.writeHead(429, { "retry-after": "0", "content-type": "text/plain" });
        res.end("rate limited");
      } else {
        res.writeHead(200, { "content-type": "application/vnd.orqenix.mesh+msgpack" });
        res.end(Buffer.from(encodeResponse({ id: "r", status: "ok" })));
      }
    });
    await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", () => resolve()));
    const addr = s.address() as { port: number };
    const c = new HttpMeshTransport({
      localScopeId: "scp_b3_A" as ScopeId,
      verifier: new NoopIdentityVerifier(),
      sign: NoopSigner,
      maxRetries: 2,
      baseDelayMs: 1,
    });
    await c.start();
    const resp = await c.send(
      { kind: "http", baseUrl: `http://127.0.0.1:${addr.port}` },
      mkReq(addr.port),
    );
    expect(resp.status).toBe("ok");
    expect(attempts).toBe(2);
    await c.stop();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });
});
