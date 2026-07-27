import { describe, it, expect } from "vitest";
import {
  b64urlDecode,
  b64urlEncode,
  ed25519Sign,
  ed25519Verify,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
  importEd25519PrivateKey,
  importEd25519PublicKey,
} from "../src/ed25519.js";

describe("Ed25519 primitives", () => {
  it("round-trip sign + verify succeeds", async () => {
    const kp = await generateEd25519Keypair();
    const msg = new TextEncoder().encode("hello orqenix");
    const sig = await ed25519Sign(kp.privateKey, msg);
    expect(await ed25519Verify(kp.publicKey, sig, msg)).toBe(true);
  });

  it("verify fails on tampered message", async () => {
    const kp = await generateEd25519Keypair();
    const msg = new TextEncoder().encode("original");
    const sig = await ed25519Sign(kp.privateKey, msg);
    const tampered = new TextEncoder().encode("original-tampered");
    expect(await ed25519Verify(kp.publicKey, sig, tampered)).toBe(false);
  });

  it("verify fails on wrong key", async () => {
    const a = await generateEd25519Keypair();
    const b = await generateEd25519Keypair();
    const msg = new TextEncoder().encode("x");
    const sig = await ed25519Sign(a.privateKey, msg);
    expect(await ed25519Verify(b.publicKey, sig, msg)).toBe(false);
  });

  it("export then import preserves the raw public key", async () => {
    const kp = await generateEd25519Keypair();
    const raw = await exportEd25519PublicKeyRaw(kp.publicKey);
    expect(raw.length).toBe(32);
    const imported = await importEd25519PublicKey(raw);
    const rawAfter = await exportEd25519PublicKeyRaw(imported);
    expect(Array.from(rawAfter)).toEqual(Array.from(raw));
  });

  it("base64url round-trip", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 255]);
    const enc = b64urlEncode(bytes);
    expect(enc).not.toMatch(/[+/=]/);
    expect(Array.from(b64urlDecode(enc))).toEqual(Array.from(bytes));
  });

  it("importEd25519PrivateKey + sign succeeds", async () => {
    const kp = await generateEd25519Keypair();
    const rawPub = await exportEd25519PublicKeyRaw(kp.publicKey);
    const rawPriv = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
    const seed = new Uint8Array(rawPriv.slice(16, 48));
    const imported = await importEd25519PrivateKey(seed);
    const msg = new TextEncoder().encode("via-imported");
    const sig = await ed25519Sign(imported, msg);
    const pub = await importEd25519PublicKey(rawPub);
    expect(await ed25519Verify(pub, sig, msg)).toBe(true);
  });

  it("importEd25519PrivateKey rejects wrong-size seed", async () => {
    await expect(importEd25519PrivateKey(new Uint8Array(31))).rejects.toThrow("32 bytes");
  });

  it("verify returns false on exception (catch path)", async () => {
    const kp = await generateEd25519Keypair();
    const badSig = new Uint8Array(16);
    const msg = new TextEncoder().encode("x");
    expect(await ed25519Verify(kp.publicKey, badSig, msg)).toBe(false);
  });
});
