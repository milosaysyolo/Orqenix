import { describe, it, expect } from "vitest";
import {
  wrapFenced,
  extractFenced,
  removeFenced,
  replaceFenced,
} from "../src/index.js";

describe("fenced blocks", () => {
  it("wraps content with markers", () => {
    const w = wrapFenced("hello");
    expect(w).toContain("orqenix:start");
    expect(w).toContain("orqenix:end");
    expect(w).toContain("hello");
  });

  it("extracts content between markers", () => {
    const src = `before\n${wrapFenced("payload")}\nafter`;
    expect(extractFenced(src)).toBe("payload");
  });

  it("extractFenced returns null when no markers", () => {
    expect(extractFenced("no markers here")).toBeNull();
  });

  it("removeFenced removes the block", () => {
    const src = `before\n${wrapFenced("payload")}\nafter`;
    const out = removeFenced(src);
    expect(out).not.toContain("orqenix:start");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("replaceFenced replaces content", () => {
    const src = `before\n${wrapFenced("old")}\nafter`;
    const out = replaceFenced(src, "new");
    expect(out).toContain("new");
    expect(out).not.toContain("old");
  });
});
