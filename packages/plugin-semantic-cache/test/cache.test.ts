import { describe, it, expect, beforeEach } from "vitest";
import { cache } from "../src/index.js";

describe("SemanticCache", () => {
  beforeEach(() => cache.clear());

  it("returns null on miss", () => {
    expect(cache.get({ model: "m", messages: [{ role: "user", content: "hi" }] })).toBeNull();
  });

  it("stores and retrieves an entry", () => {
    cache.set(
      { model: "m", messages: [{ role: "user", content: "hi" }] },
      { content: "hello", tokens: { input: 1, output: 1 } },
    );
    const got = cache.get({ model: "m", messages: [{ role: "user", content: "hi" }] });
    expect(got?.content).toBe("hello");
  });

  it("normalizes whitespace in cache key", () => {
    cache.set(
      { model: "m", messages: [{ role: "user", content: "  hi  " }] },
      { content: "hello", tokens: { input: 1, output: 1 } },
    );
    expect(
      cache.get({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).not.toBeNull();
  });
});
