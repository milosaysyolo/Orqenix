import { blake3 as nobleBlake3 } from "@noble/hashes/blake3";
import { bytesToHex as toHex } from "@noble/hashes/utils";

export const BLAKE3_HEX_LENGTH = 64 as const;
export const BLAKE3_BYTE_LENGTH = 32 as const;
export const BLAKE3_KEY_LENGTH = 32 as const;
export const BLAKE3_HEX_PATTERN = /^[0-9a-f]{64}$/;

function toBuffer(input: string | Buffer | Uint8Array): Uint8Array {
  if (typeof input === "string") return new TextEncoder().encode(input);
  return input instanceof Buffer ? new Uint8Array(input) : input;
}

export function blake3Hex(input: string | Buffer | Uint8Array): string {
  return toHex(nobleBlake3(toBuffer(input)));
}

export function blake3Bytes(input: string | Buffer | Uint8Array): Uint8Array {
  return nobleBlake3(toBuffer(input));
}

export function blake3KeyedHex(input: string | Buffer | Uint8Array, key: Uint8Array): string {
  if (key.length !== BLAKE3_KEY_LENGTH) {
    throw new Error(`BLAKE3 key must be exactly ${BLAKE3_KEY_LENGTH} bytes, got ${key.length}`);
  }
  return toHex(nobleBlake3(toBuffer(input), { key }));
}

export function isValidBlake3Hex(value: unknown): value is string {
  return typeof value === "string" && BLAKE3_HEX_PATTERN.test(value);
}

export function blake3HexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export interface Blake3Hasher {
  update(input: string | Buffer | Uint8Array): this;
  digest(): string;
  digestBytes(): Uint8Array;
}

export function createBlake3Hasher(): Blake3Hasher {
  const hasher = nobleBlake3.create();
  return {
    update(input: string | Buffer | Uint8Array): Blake3Hasher {
      hasher.update(toBuffer(input));
      return this;
    },
    digest(): string {
      return toHex(hasher.digest());
    },
    digestBytes(): Uint8Array {
      return hasher.digest();
    },
  };
}
