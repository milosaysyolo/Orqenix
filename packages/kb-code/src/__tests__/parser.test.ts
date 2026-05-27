import { describe, it, expect } from "vitest";
import { loadParser } from "../parser";
import { extractSymbols } from "../symbols";

describe("kb-code parser", () => {
  it("parses TypeScript and finds functions and classes", async () => {
    const p = await loadParser("typescript");
    const src = `export function foo(x: number) { return x; }\nexport class Bar {}`;
    const syms = extractSymbols(p, src, "typescript");
    expect(syms.find(s => s.name === "foo" && s.kind === "function")).toBeTruthy();
    expect(syms.find(s => s.name === "Bar" && s.kind === "class")).toBeTruthy();
  });

  it("parses Python and finds class with methods", async () => {
    const p = await loadParser("python");
    const src = `class Foo:\n  def bar(self): pass\n  def baz(self): pass`;
    const syms = extractSymbols(p, src, "python");
    expect(syms.filter(s => s.kind === "function").length).toBeGreaterThanOrEqual(2);
  });

  it("parses Rust and finds structs and traits", async () => {
    const p = await loadParser("rust");
    const src = `struct Foo { x: i32 }\ntrait Bar { fn baz(&self); }`;
    const syms = extractSymbols(p, src, "rust");
    expect(syms.find(s => s.name === "Foo")).toBeTruthy();
    expect(syms.find(s => s.name === "Bar")).toBeTruthy();
  });

  it("parses Go and finds methods", async () => {
    const p = await loadParser("go");
    const src = `package x\nfunc (s *Foo) Bar() {}`;
    const syms = extractSymbols(p, src, "go");
    expect(syms.find(s => s.name === "Bar")).toBeTruthy();
  });

  it("extracts correct line numbers", async () => {
    const p = await loadParser("typescript");
    const src = `function foo() {}\nfunction bar() {}`;
    const syms = extractSymbols(p, src, "typescript");
    const foo = syms.find(s => s.name === "foo");
    expect(foo?.startLine).toBe(1);
  });

  it("handles empty source", async () => {
    const p = await loadParser("typescript");
    const syms = extractSymbols(p, "", "typescript");
    expect(syms.length).toBe(0);
  });

  it("caches language modules", async () => {
    const p1 = await loadParser("typescript");
    const p2 = await loadParser("typescript");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
  });
});
