import { describe, it, expect } from "vitest";
import { loadParser } from "../parser";

describe("kb-code watcher", () => {
  it("parser initializes successfully", async () => {
    const p = await loadParser("typescript");
    expect(p).toBeDefined();
  });

  it("parser can parse multiple times", async () => {
    const p = await loadParser("typescript");
    const tree1 = p.parse("function foo() {}");
    const tree2 = p.parse("function bar() {}");
    expect(tree1).toBeDefined();
    expect(tree2).toBeDefined();
  });

  it("supports multiple languages", async () => {
    const ts = await loadParser("typescript");
    const py = await loadParser("python");
    const rs = await loadParser("rust");
    expect(ts).toBeDefined();
    expect(py).toBeDefined();
    expect(rs).toBeDefined();
  });

  it("handles syntax errors gracefully", async () => {
    const p = await loadParser("typescript");
    const tree = p.parse("function foo( {");
    expect(tree).toBeDefined();
  });
});
