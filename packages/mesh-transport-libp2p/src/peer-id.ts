import { generateKeyPairFromSeed } from "@libp2p/crypto/keys";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import type { PeerId, PrivateKey } from "@libp2p/interface";
import type { ScopeId } from "@orqenix/mesh-transport-core";

const INFO_LABEL = "orqenix/mesh/peer/v1";

export async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

export interface DerivePeerKeyInput {
  scopeSeed: Uint8Array;
  scopeIdBytes: Uint8Array;
}

export interface DerivedPeer {
  peerId: PeerId;
  privateKey: PrivateKey;
  derivedSeed: Uint8Array;
}

export async function derivePeerFromScope(input: DerivePeerKeyInput): Promise<DerivedPeer> {
  if (input.scopeSeed.length !== 32) {
    throw new Error("scopeSeed must be 32 bytes");
  }
  if (input.scopeIdBytes.length !== 32) {
    throw new Error("scopeIdBytes must be 32 bytes");
  }
  const info = new TextEncoder().encode(INFO_LABEL);
  const okm = await hkdfSha256(input.scopeSeed, input.scopeIdBytes, info, 32);
  const privateKey = await generateKeyPairFromSeed("Ed25519", okm);
  const peerId = peerIdFromPrivateKey(privateKey);
  return { peerId, privateKey, derivedSeed: okm };
}

export function scopeIdToSaltBytes(scopeId: ScopeId): Uint8Array {
  const hex = String(scopeId).replace(/^scp_b3_/, "");
  if (hex.length === 64 && /^[0-9a-f]+$/i.test(hex)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const bytes = new TextEncoder().encode(String(scopeId));
  const out = new Uint8Array(32);
  for (let i = 0; i < bytes.length && i < 32; i++) out[i] = bytes[i];
  return out;
}
