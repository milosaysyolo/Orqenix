import { describe, it, expect } from "vitest";
import {
  blake3Hex,
  blake3Bytes,
  blake3KeyedHex,
  isValidBlake3Hex,
  blake3HexEqual,
  createBlake3Hasher,
  BLAKE3_HEX_LENGTH,
  BLAKE3_BYTE_LENGTH,
  BLAKE3_KEY_LENGTH,
  BLAKE3_HEX_PATTERN,
} from "../src/blake3.js";

describe("BLAKE3 utilities", () => {
  describe("blake3Hex", () => {
    it("produces 64-character hex string", () => {
      const hash = blake3Hex("hello");
      expect(hash).toHaveLength(BLAKE3_HEX_LENGTH);
      expect(hash).toMatch(BLAKE3_HEX_PATTERN);
    });

    it("is deterministic", () => {
      const hash1 = blake3Hex("test input");
      const hash2 = blake3Hex("test input");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = blake3Hex("input a");
      const hash2 = blake3Hex("input b");
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty string", () => {
      const hash = blake3Hex("");
      expect(hash).toHaveLength(BLAKE3_HEX_LENGTH);
    });

    it("handles Buffer input", () => {
      const buffer = Buffer.from("test", "utf-8");
      const hash = blake3Hex(buffer);
      expect(hash).toHaveLength(BLAKE3_HEX_LENGTH);
      expect(hash).toBe(blake3Hex("test"));
    });

    it("handles Uint8Array input", () => {
      const bytes = new TextEncoder().encode("test");
      const hash = blake3Hex(bytes);
      expect(hash).toBe(blake3Hex("test"));
    });

    it("handles large input", () => {
      const largeInput = "x".repeat(1_000_000);
      const hash = blake3Hex(largeInput);
      expect(hash).toHaveLength(BLAKE3_HEX_LENGTH);
    });
  });

  describe("blake3Bytes", () => {
    it("returns 32-byte Uint8Array", () => {
      const bytes = blake3Bytes("hello");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(BLAKE3_BYTE_LENGTH);
    });
  });

  describe("blake3KeyedHex", () => {
    it("requires 32-byte key", () => {
      const invalidKey = new Uint8Array(16);
      expect(() => blake3KeyedHex("test", invalidKey)).toThrow();
    });

    it("produces different hash with different key", () => {
      const key1 = new Uint8Array(BLAKE3_KEY_LENGTH).fill(1);
      const key2 = new Uint8Array(BLAKE3_KEY_LENGTH).fill(2);
      const hash1 = blake3KeyedHex("test", key1);
      const hash2 = blake3KeyedHex("test", key2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isValidBlake3Hex", () => {
    it("accepts valid hex hash", () => {
      const hash = blake3Hex("test");
      expect(isValidBlake3Hex(hash)).toBe(true);
    });

    it("rejects wrong length", () => {
      expect(isValidBlake3Hex("abc")).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidBlake3Hex(null)).toBe(false);
      expect(isValidBlake3Hex(123)).toBe(false);
    });
  });

  describe("blake3HexEqual", () => {
    it("returns true for identical hashes", () => {
      const hash = blake3Hex("test");
      expect(blake3HexEqual(hash, hash)).toBe(true);
    });

    it("returns false for different hashes", () => {
      const a = blake3Hex("a");
      const b = blake3Hex("b");
      expect(blake3HexEqual(a, b)).toBe(false);
    });
  });

  describe("Streaming hasher", () => {
    it("produces same result as direct hash", () => {
      const directHash = blake3Hex("hello world");
      const hasher = createBlake3Hasher();
      hasher.update("hello").update(" ").update("world");
      const streamingHash = hasher.digest();
      expect(streamingHash).toBe(directHash);
    });

    it("supports chained updates", () => {
      const hasher = createBlake3Hasher();
      const result = hasher.update("a").update("b").digest();
      expect(result).toBe(blake3Hex("ab"));
    });
  });
});
