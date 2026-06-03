import { blake3Bytes } from "@orqenix/core";
import { Buffer } from "node:buffer";
import { CONTENT_HASH_PATTERN, ContentHashMismatchError, type ContentHash } from "./contracts.js";

export function hashBytes(bytes: Uint8Array): ContentHash {
  const digest = blake3Bytes(bytes);
  return Buffer.from(digest).toString("hex") as ContentHash;
}

export function hashString(s: string): ContentHash {
  return hashBytes(new TextEncoder().encode(s));
}

export function isContentHash(v: unknown): v is ContentHash {
  return typeof v === "string" && CONTENT_HASH_PATTERN.test(v);
}

export function verifyContentHash(bytes: Uint8Array, expected: ContentHash): void {
  const actual = hashBytes(bytes);
  if (actual !== expected) throw new ContentHashMismatchError(expected, actual);
}
