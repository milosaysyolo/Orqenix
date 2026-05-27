import { describe, it, expect } from "vitest";
import { loadParser } from "../parser";
import { extractSymbols } from "../symbols";

describe("kb-code symbols", () => {
  it("extracts TypeScript interfaces", async () => {
    const p = await loadParser("typescript");
    const src = `interface User { name: string; }`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.name === "User" && s.kind === "interface")).toBeTruthy();
  });

  it("extracts TypeScript type aliases", async () => {
    const p = await loadParser("typescript");
    const src = `type ID = string | number;`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.name === "ID" && s.kind === "type")).toBeTruthy();
  });

  it("extracts TypeScript enums", async () => {
    const p = await loadParser("typescript");
    const src = `enum Color { Red, Green, Blue }`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.name === "Color" && s.kind === "enum")).toBeTruthy();
  });

  it("extracts method definitions", async () => {
    const p = await loadParser("typescript");
    const src = `class Foo { method() {} }`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.kind === "method")).toBeTruthy();
  });

  it("extracts const declarations", async () => {
    const p = await loadParser("typescript");
    const src = `const x = 42;`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.name === "x" && s.kind === "const")).toBeTruthy();
  });

  it("includes signature in symbol", async () => {
    const p = await loadParser("typescript");
    const src = `function add(a: number, b: number): number { return a + b; }`;
    const syms = extractSymbols(p, src, "typescript");
    const sym = syms.find(s => s.name === "add");
    expect(sym?.signature).toContain("function");
  });
});
