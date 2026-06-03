import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  derivePublicKey,
  serializePublicKey,
  deserializePublicKey,
  serializePrivateKey,
  deserializePrivateKey,
  verifyKeyPair,
} from "../src/keypair";

describe("keypair", () => {
  it("generates 32-byte Ed25519 pairs", async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    expect(publicKey).toHaveLength(32);
    expect(privateKey).toHaveLength(32);
  });

  it("derives the same public key deterministically", async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    const derived = await derivePublicKey(privateKey);
    expect(Array.from(derived)).toEqual(Array.from(publicKey));
  });

  it("round-trips public key through base64", async () => {
    const { publicKey } = await generateKeyPair();
    const b64 = serializePublicKey(publicKey);
    expect(b64).toHaveLength(44);
    const back = deserializePublicKey(b64);
    expect(Array.from(back)).toEqual(Array.from(publicKey));
  });

  it("round-trips private key through PEM", async () => {
    const { privateKey } = await generateKeyPair();
    const pem = serializePrivateKey(privateKey);
    expect(pem).toContain("-----BEGIN ORQENIX ED25519 PRIVATE KEY-----");
    expect(pem).toContain("-----END ORQENIX ED25519 PRIVATE KEY-----");
    const back = deserializePrivateKey(pem);
    expect(Array.from(back)).toEqual(Array.from(privateKey));
  });

  it("rejects PEM with wrong header", () => {
    expect(() =>
      deserializePrivateKey("-----BEGIN RSA PRIVATE KEY-----\nAAA\n-----END RSA PRIVATE KEY-----"),
    ).toThrow(/PEM header\/footer mismatch/);
  });

  it("verifyKeyPair returns true for valid pair", async () => {
    const pair = await generateKeyPair();
    expect(await verifyKeyPair(pair)).toBe(true);
  });

  it("verifyKeyPair returns false when public key tampered", async () => {
    const pair = await generateKeyPair();
    const tampered = new Uint8Array(pair.publicKey);
    tampered[0] = (tampered[0] + 1) & 0xff;
    expect(await verifyKeyPair({ publicKey: tampered, privateKey: pair.privateKey })).toBe(false);
  });

  it("rejects non-32-byte public key", () => {
    expect(() => serializePublicKey(new Uint8Array(16))).toThrow(/must be 32 bytes/);
    expect(() => deserializePublicKey(Buffer.from(new Uint8Array(16)).toString("base64"))).toThrow(
      /must be 32 bytes/,
    );
  });
});
