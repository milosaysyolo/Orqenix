import { describe, it, expect } from "vitest";
import { PROTOCOL_ID, isSupportedProtocol, supportedProtocols } from "../src/protocol.js";

describe("protocol id", () => {
  it("is exactly /orqenix/mesh/1.0.0", () => {
    expect(PROTOCOL_ID).toBe("/orqenix/mesh/1.0.0");
  });

  it("rejects mismatched versions", () => {
    expect(isSupportedProtocol("/orqenix/mesh/1.0.0")).toBe(true);
    expect(isSupportedProtocol("/orqenix/mesh/1.0.1")).toBe(false);
    expect(isSupportedProtocol("/orqenix/mesh/2.0.0")).toBe(false);
    expect(isSupportedProtocol("/ipfs/kad/1.0.0")).toBe(false);
  });

  it("exposes the protocol in its supported list", () => {
    expect(supportedProtocols()).toContain(PROTOCOL_ID);
  });
});
