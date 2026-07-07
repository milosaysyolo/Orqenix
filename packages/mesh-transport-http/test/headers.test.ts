// packages/mesh-transport-http/test/headers.test.ts
import { describe, it, expect } from "vitest";
import {
  buildHeaders,
  assertHeadersMatchBody,
  b64urlEncode,
  b64urlDecode,
  HDR,
} from "../src/headers.js";
import {
  CapabilityError,
  type CapabilityToken,
  type MeshRequest,
  type ScopeId,
} from "@orqenix/mesh-transport-core";

function mkReq(id = "01HV0R6X3M8YQ9G7F2D5W1KZJP"): MeshRequest {
  return {
    id,
    fromScope: "scp_b3_A" as ScopeId,
    toScope: "scp_b3_B" as ScopeId,
    capability: "cap_test" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + 1000,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
}

describe("headers", () => {
  it("builds and parses round-trip", () => {
    const req = mkReq();
    const h = buildHeaders(req, "sig123");
    expect(h[HDR.REQUEST_ID]).toBe(req.id);
    expect(h[HDR.SCOPE_SIG]).toBe("sig123");
    expect(() => assertHeadersMatchBody(h, req)).not.toThrow();
  });

  it("throws E_ENVELOPE_MISMATCH on id mismatch", () => {
    const req = mkReq();
    const h = buildHeaders(req, "sig");
    h[HDR.REQUEST_ID] = "wrong-id";
    expect(() => assertHeadersMatchBody(h, req)).toThrow(CapabilityError);
  });

  it("base64url round-trip", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252]);
    const enc = b64urlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/);
    const dec = b64urlDecode(enc);
    expect(Array.from(dec)).toEqual(Array.from(bytes));
  });

  it("throws on deadline mismatch", () => {
    const req = mkReq();
    const h = buildHeaders(req, "sig");
    h[HDR.DEADLINE_MS] = "999";
    expect(() => assertHeadersMatchBody(h, req)).toThrow(CapabilityError);
  });

  it("throws on missing capability header", () => {
    const req = mkReq();
    const h = buildHeaders(req, "sig");
    delete h[HDR.CAPABILITY];
    expect(() => assertHeadersMatchBody(h, req)).toThrow(CapabilityError);
  });

  it("throws on capability body mismatch", () => {
    const req = mkReq();
    req.capability = "cap_original" as CapabilityToken;
    const h = buildHeaders(mkReq(), "sig");
    expect(() => assertHeadersMatchBody(h, req)).toThrow(CapabilityError);
  });
});
