import { describe, it, expect } from "vitest";
import { compileGlob, matches, methodAllowed } from "../src/glob.js";

describe("method glob", () => {
  it("literal matches exact only", () => {
    const p = compileGlob("memory.query");
    expect(matches(p, "memory.query")).toBe(true);
    expect(matches(p, "memory.queryx")).toBe(false);
    expect(matches(p, "memory")).toBe(false);
    expect(matches(p, "memory.query.extra")).toBe(false);
  });

  it("* matches exactly one segment", () => {
    const p = compileGlob("memory.*");
    expect(matches(p, "memory.query")).toBe(true);
    expect(matches(p, "memory.insert")).toBe(true);
    expect(matches(p, "memory.kb.search")).toBe(false);
    expect(matches(p, "memory.")).toBe(false);
  });

  it("** matches zero or more segments", () => {
    const p = compileGlob("memory.**");
    expect(matches(p, "memory")).toBe(true);
    expect(matches(p, "memory.query")).toBe(true);
    expect(matches(p, "memory.kb.recall.advanced")).toBe(true);
    expect(matches(p, "mem")).toBe(false);
  });

  it("rejects mixed-character segments", () => {
    expect(() => compileGlob("memory.que*")).toThrow();
  });

  it("methodAllowed matches any pattern in caps", () => {
    expect(methodAllowed(["memory.query", "kb.recall.*"], "kb.recall.advanced")).toBe(true);
    expect(methodAllowed(["memory.query"], "kb.recall.advanced")).toBe(false);
  });
});
