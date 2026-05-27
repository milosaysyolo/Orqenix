import { describe, it, expect } from "vitest";
import { extractSymbols, parseSource } from "../src/index.js";

describe("kb-code edge cases", () => {
  it("handles empty input", async () => {
    const syms = await extractSymbols("", "typescript");
    expect(syms).toHaveLength(0);
  });

  it("handles syntax error gracefully", async () => {
    const tree = await parseSource("function (", "typescript");
    expect(tree.rootNode.hasError).toBe(true);
  });

  it("handles multi-symbol file", async () => {
    const src = `
      function a() {}
      function b() {}
      class C {}
      interface I {}
    `;
    const syms = await extractSymbols(src, "typescript");
    expect(syms.filter((s) => s.kind === "function")).toHaveLength(2);
    expect(syms.some((s) => s.kind === "class")).toBe(true);
    expect(syms.some((s) => s.kind === "interface")).toBe(true);
  });

  it("preserves identifier with non-ASCII chars", async () => {
    const syms = await extractSymbols("function δ() {}", "typescript");
    expect(syms.some((s) => s.name === "δ")).toBe(true);
  });
});
