import { describe, it, expect, vi } from "vitest";
import { TokenBridge } from "../src/token-bridge.js";
import { encodeCapabilityToken } from "../src/capability-token.js";
import type { CapabilityVerifier } from "../src/verifier.js";
import type { CapabilityTokenFields } from "../src/capability-token.js";
import type { VerifyResult } from "../src/verifier.js";

function mkVerifier(): CapabilityVerifier {
  return {
    verify: vi.fn().mockResolvedValue({ ok: true } as VerifyResult),
    verifyCapability: vi.fn(),
    createToken: vi.fn(),
  } as unknown as CapabilityVerifier;
}

function mkTokenFields(over: Partial<CapabilityTokenFields> = {}): CapabilityTokenFields {
  return {
    iss: "scp_b3_B",
    sub: "scp_b3_A",
    caps: ["memory.query"],
    exp: Date.now() + 60_000,
    jti: "01HV0R6X3M8YQ9G7F2D5W1KZJP",
    sig: "noop",
    ...over,
  };
}

describe("TokenBridge", () => {
  it("delegates to verifier on valid transport-security token", async () => {
    const verifier = mkVerifier();
    const bridge = new TokenBridge(verifier);
    const token = encodeCapabilityToken(mkTokenFields());

    const result = await bridge.verify({
      capability: token,
      fromScope: "scp_b3_A",
      toScope: "scp_b3_B",
      method: "memory.query",
    });

    expect(result.ok).toBe(true);
    expect(verifier.verify).toHaveBeenCalled();
  });

  it("returns CAP_MALFORMED on garbage token", async () => {
    const verifier = mkVerifier();
    const bridge = new TokenBridge(verifier);

    const result = await bridge.verify({
      capability: "not-a-valid-token!!!",
      fromScope: "scp_b3_A",
      toScope: "scp_b3_B",
      method: "memory.query",
    });

    expect(result.ok).toBe(false);
  });

  it("handles non-Error throws without crashing", async () => {
    // Create a bridge where tryDecode will throw a non-Error value
    const verifier = mkVerifier();
    const bridge = new TokenBridge(verifier);

    // A completely malformed token that triggers a non-Error throw
    const result = await bridge.verify({
      capability: String.raw`\x80\x81\x82`,
      fromScope: "scp_b3_A",
      toScope: "scp_b3_B",
      method: "memory.query",
    });

    // Should not crash — returns CAP_MALFORMED with stringified error
    expect(result.ok).toBe(false);
  });
});
