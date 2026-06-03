import { blake3Bytes, canonicalJson } from "@orqenix/core";
import {
  type CapabilityToken,
  type EncodedToken,
  type TokenHeader,
  type TokenPayload,
  type TokenId,
  TokenHeaderSchema,
  TokenPayloadSchema,
  TOKEN_ID_PATTERN,
  InvalidTokenFormatError,
} from "./contracts.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) {
    throw new InvalidTokenFormatError("base64url contains invalid characters");
  }
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const std = padded.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(std, "base64"));
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function utf8Decode(b: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(b);
}

export function canonicalSigningInput(header: TokenHeader, payload: TokenPayload): Uint8Array {
  const h = base64UrlEncode(utf8Encode(canonicalJson(header)));
  const p = base64UrlEncode(utf8Encode(canonicalJson(payload)));
  return utf8Encode(`${h}.${p}`);
}

export function computeJti(payloadWithoutJti: Omit<TokenPayload, "jti">): TokenId {
  const json = canonicalJson(payloadWithoutJti);
  const digest = blake3Bytes(utf8Encode(json));
  const truncated = digest.slice(0, 20);
  const id = `tok:${encodeBase32(truncated)}`;
  if (!TOKEN_ID_PATTERN.test(id)) {
    throw new InvalidTokenFormatError(`derived token id failed format check: ${id}`);
  }
  return id as TokenId;
}

export function deriveTokenId(payload: TokenPayload): TokenId {
  const { jti: _ignored, ...rest } = payload;
  return computeJti(rest);
}

export function encodeToken(token: CapabilityToken): EncodedToken {
  const h = base64UrlEncode(utf8Encode(canonicalJson(token.header)));
  const p = base64UrlEncode(utf8Encode(canonicalJson(token.payload)));
  const s = base64UrlEncode(token.signature);
  return `${h}.${p}.${s}` as EncodedToken;
}

export function decodeToken(input: string): CapabilityToken {
  if (typeof input !== "string") {
    throw new InvalidTokenFormatError("input must be a string");
  }
  const parts = input.split(".");
  if (parts.length !== 3) {
    throw new InvalidTokenFormatError(`expected 3 parts separated by ".", got ${parts.length}`);
  }
  const hPart = parts[0]!;
  const pPart = parts[1]!;

  let headerObj: unknown;
  let payloadObj: unknown;
  try {
    headerObj = JSON.parse(utf8Decode(base64UrlDecode(hPart)));
  } catch (e) {
    throw new InvalidTokenFormatError(`header decode error: ${(e as Error).message}`);
  }
  try {
    payloadObj = JSON.parse(utf8Decode(base64UrlDecode(pPart)));
  } catch (e) {
    throw new InvalidTokenFormatError(`payload decode error: ${(e as Error).message}`);
  }

  const headerResult = TokenHeaderSchema.safeParse(headerObj);
  if (!headerResult.success) {
    throw new InvalidTokenFormatError(`header schema error: ${headerResult.error.message}`);
  }
  const payloadResult = TokenPayloadSchema.safeParse(payloadObj);
  if (!payloadResult.success) {
    throw new InvalidTokenFormatError(`payload schema error: ${payloadResult.error.message}`);
  }

  let signature: Uint8Array;
  try {
    signature = base64UrlDecode(parts[2]!);
  } catch (e) {
    throw new InvalidTokenFormatError(`signature decode error: ${(e as Error).message}`);
  }
  if (signature.length !== 64) {
    throw new InvalidTokenFormatError(
      `Ed25519 signature must be 64 bytes, got ${signature.length}`,
    );
  }

  return { header: headerResult.data, payload: payloadResult.data, signature };
}
