import { describe, it, expect } from "vitest";
import { canonicalJson, parseCanonicalJson, isCanonical } from "../src/canonical-json.js";

describe("Canonical JSON", () => {
  describe("canonicalJson", () => {
    it("handles null", () => {
      expect(canonicalJson(null)).toBe("null");
    });

    it("handles booleans", () => {
      expect(canonicalJson(true)).toBe("true");
      expect(canonicalJson(false)).toBe("false");
    });

    it("handles numbers", () => {
      expect(canonicalJson(0)).toBe("0");
      expect(canonicalJson(42)).toBe("42");
      expect(canonicalJson(3.14)).toBe("3.14");
    });

    it("rejects non-finite numbers", () => {
      expect(() => canonicalJson(NaN)).toThrow();
      expect(() => canonicalJson(Infinity)).toThrow();
    });

    it("handles strings", () => {
      expect(canonicalJson("hello")).toBe('"hello"');
      expect(canonicalJson("")).toBe('""');
    });

    it("sorts object keys alphabetically", () => {
      expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    });

    it("produces same output regardless of key insertion order", () => {
      const obj1 = { x: 1, y: 2, z: 3 };
      const obj2 = { z: 3, y: 2, x: 1 };
      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    });

    it("handles nested objects", () => {
      const input = { outer: { y: 2, x: 1 }, prefix: "a" };
      expect(canonicalJson(input)).toBe('{"outer":{"x":1,"y":2},"prefix":"a"}');
    });

    it("handles arrays", () => {
      expect(canonicalJson([1, 2, 3])).toBe("[1,2,3]");
    });

    it("handles mixed nested structures", () => {
      const input = {
        users: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
        count: 2,
      };
      expect(canonicalJson(input)).toBe(
        '{"count":2,"users":[{"age":30,"name":"Alice"},{"age":25,"name":"Bob"}]}',
      );
    });

    it("skips undefined values in objects", () => {
      const input = { a: 1, b: undefined, c: 3 };
      expect(canonicalJson(input)).toBe('{"a":1,"c":3}');
    });

    it("rejects functions", () => {
      expect(() => canonicalJson(() => null)).toThrow();
    });
  });

  describe("parseCanonicalJson", () => {
    it("parses valid JSON", () => {
      expect(parseCanonicalJson('{"a":1}')).toEqual({ a: 1 });
    });

    it("throws on invalid JSON", () => {
      expect(() => parseCanonicalJson("not json")).toThrow();
    });
  });

  describe("isCanonical", () => {
    it("recognizes canonical form", () => {
      expect(isCanonical('{"a":1,"b":2}')).toBe(true);
    });

    it("rejects non-canonical form", () => {
      expect(isCanonical('{"b":2,"a":1}')).toBe(false);
    });
  });

  describe("Round-trip", () => {
    it("canonical -> parse -> canonical is stable", () => {
      const inputs = [
        { a: 1, b: 2 },
        [1, 2, 3],
        { nested: { z: 1, a: 2 }, arr: [1, 2] },
        null,
        true,
        42,
      ];
      for (const input of inputs) {
        const c1 = canonicalJson(input);
        const parsed = parseCanonicalJson(c1);
        const c2 = canonicalJson(parsed);
        expect(c2).toBe(c1);
      }
    });
  });
});
