import { describe, it, expect } from "vitest";
import { Ed25519IdentityVerifier, makeEd25519IdentityVerifier } from "../src/adapters.js";
import { Ed25519Signer } from "../src/signer.js";
import { LRUKeyStore } from "../src/key-store.js";
import { exportEd25519PublicKeyRaw, generateEd25519Keypair } from "../src/ed25519.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

describe("Ed25519IdentityVerifier (structural)", () => {
  it("verifies a signer-produced proof end-to-end", async () => {
    const kp = await generateEd25519Keypair();
    const fromScope = "scp_b3_A" as ScopeId;
    const ks = new LRUKeyStore();
    ks.put(fromScope, await exportEd25519PublicKeyRaw(kp.publicKey));

    const signer = new Ed25519Signer({ fromScope, privateKey: kp.privateKey });
    const sig = await signer.signScopeProof("rid-X", "scp_b3_B" as ScopeId);

    const verifier = makeEd25519IdentityVerifier(ks);
    expect(await verifier.verifyScopeSig(fromScope, "rid-X", "scp_b3_B" as ScopeId, sig)).toBe(
      true,
    );
  });

  it("rejects wrong scope", async () => {
    const kp = await generateEd25519Keypair();
    const fromScope = "scp_b3_A" as ScopeId;
    const ks = new LRUKeyStore();
    ks.put(fromScope, await exportEd25519PublicKeyRaw(kp.publicKey));

    const signer = new Ed25519Signer({ fromScope, privateKey: kp.privateKey });
    const sig = await signer.signScopeProof("rid-X", "scp_b3_B" as ScopeId);

    const verifier = new Ed25519IdentityVerifier({ keyStore: ks });
    expect(await verifier.verifyScopeSig(fromScope, "rid-X", "scp_b3_OTHER" as ScopeId, sig)).toBe(
      false,
    );
  });

  it("rejects when issuer key is not in the store", async () => {
    const kp = await generateEd25519Keypair();
    const signer = new Ed25519Signer({
      fromScope: "scp_b3_A" as ScopeId,
      privateKey: kp.privateKey,
    });
    const sig = await signer.signScopeProof("rid-X", "scp_b3_B" as ScopeId);
    const verifier = new Ed25519IdentityVerifier({ keyStore: new LRUKeyStore() });
    expect(
      await verifier.verifyScopeSig("scp_b3_A" as ScopeId, "rid-X", "scp_b3_B" as ScopeId, sig),
    ).toBe(false);
  });

  it("rejects empty inputs without throwing", async () => {
    const verifier = new Ed25519IdentityVerifier({ keyStore: new LRUKeyStore() });
    expect(await verifier.verifyScopeSig("" as ScopeId, "x", "y" as ScopeId, "z")).toBe(false);
  });
});
