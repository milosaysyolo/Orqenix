import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalIdentity } from "../src/identity-loader.js";
import { generateEd25519Keypair, exportEd25519PublicKeyRaw } from "@orqenix/transport-security";
import { webcrypto } from "node:crypto";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function makeFixture() {
  const seed = new Uint8Array(32);
  webcrypto.getRandomValues(seed);
  const kp = await generateEd25519Keypair();
  const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
  const seedForTest = new Uint8Array(32).fill(7);
  return { pubRaw, seedForTest };
}

describe("identity loader", () => {
  it("loads scope.yaml + private.pem and exposes 32-byte seed + CryptoKey objects", async () => {
    const { pubRaw, seedForTest } = await makeFixture();
    const dir = await mkdtemp(join(tmpdir(), "orqenix-id-"));
    try {
      await mkdir(join(dir, "identity"), { recursive: true });
      await writeFile(
        join(dir, "identity", "scope.yaml"),
        `
scope_id: scp_b3_test
public_key_b64: "${toBase64(pubRaw)}"
`,
      );
      await writeFile(
        join(dir, "identity", "private.pem"),
        `-----BEGIN ORQENIX ED25519 SEED-----
${toBase64(seedForTest)}
-----END ORQENIX ED25519 SEED-----
`,
      );
      const id = await loadLocalIdentity(
        join(dir, "identity", "scope.yaml"),
        join(dir, "identity", "private.pem"),
      );
      expect(id.scopeId).toBe("scp_b3_test");
      expect(id.publicKeyRaw.length).toBe(32);
      expect(id.scopeSeed.length).toBe(32);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing PEM block", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-id-"));
    try {
      await mkdir(join(dir, "identity"), { recursive: true });
      await writeFile(
        join(dir, "identity", "scope.yaml"),
        `scope_id: x\npublic_key_b64: "${toBase64(new Uint8Array(32))}"`,
      );
      await writeFile(join(dir, "identity", "private.pem"), "not a pem");
      await expect(
        loadLocalIdentity(
          join(dir, "identity", "scope.yaml"),
          join(dir, "identity", "private.pem"),
        ),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
