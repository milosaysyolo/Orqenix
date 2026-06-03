import { blake3Bytes } from "@orqenix/core";
import { type ScopeId, isScopeId, InvalidScopeIdError, SCOPE_ID_PATTERN } from "./contracts.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return output;
}

export function deriveScopeId(publicKey: Uint8Array): ScopeId {
  if (publicKey.length !== 32) {
    throw new InvalidScopeIdError(`expected 32-byte public key, got ${publicKey.length}`);
  }
  const digest = blake3Bytes(publicKey);
  const truncated = digest.slice(0, 20);
  const encoded = encodeBase32(truncated);
  const id = `scope:${encoded}`;
  if (!SCOPE_ID_PATTERN.test(id)) {
    throw new InvalidScopeIdError(`derived id failed format check: ${id}`);
  }
  return id as ScopeId;
}

export function parseScopeId(input: string): ScopeId | null {
  return isScopeId(input) ? (input as ScopeId) : null;
}

export function assertScopeId(input: string): ScopeId {
  const parsed = parseScopeId(input);
  if (parsed === null) throw new InvalidScopeIdError(input);
  return parsed;
}
