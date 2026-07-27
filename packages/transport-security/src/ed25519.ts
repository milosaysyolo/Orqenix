const subtle: SubtleCrypto = globalThis.crypto.subtle;

function toBuf(src: Uint8Array): ArrayBuffer {
  return src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer;
}

export interface Ed25519Keypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateEd25519Keypair(): Promise<Ed25519Keypair> {
  const kp = (await subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function importEd25519PublicKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("ed25519: public key must be 32 bytes");
  return await subtle.importKey("raw", toBuf(raw), "Ed25519", true, ["verify"]);
}

export async function importEd25519PrivateKey(seed: Uint8Array): Promise<CryptoKey> {
  if (seed.length !== 32) throw new Error("ed25519: private seed must be 32 bytes");
  const pkcs8 = wrapEd25519SeedAsPkcs8(seed);
  return await subtle.importKey("pkcs8", toBuf(pkcs8), "Ed25519", false, ["sign"]);
}

export async function exportEd25519PublicKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await subtle.exportKey("raw", key));
}

export async function ed25519Sign(privateKey: CryptoKey, message: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.sign("Ed25519", privateKey, toBuf(message)));
}

export async function ed25519Verify(
  publicKey: CryptoKey,
  signature: Uint8Array,
  message: Uint8Array,
): Promise<boolean> {
  try {
    return await subtle.verify("Ed25519", publicKey, toBuf(signature), toBuf(message));
  } catch {
    return false;
  }
}

function wrapEd25519SeedAsPkcs8(seed: Uint8Array): Uint8Array {
  const prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ]);
  const out = new Uint8Array(prefix.length + 32);
  out.set(prefix, 0);
  out.set(seed, prefix.length);
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64"));
}
