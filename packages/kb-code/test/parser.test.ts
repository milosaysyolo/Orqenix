import { describe, it, expect } from "vitest";
import { parseSource, extractSymbols } from "../src/index.js";

describe("kb-code TypeScript", () => {
  it("parses TS function", async () => {
    const tree = await parseSource("function hello() {}", "typescript");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("extracts function symbol", async () => {
    const syms = await extractSymbols("function foo() {}", "typescript");
    expect(syms.find((s) => s.kind === "function" && s.name === "foo")).toBeDefined();
  });

  it("extracts class symbol", async () => {
    const syms = await extractSymbols("class Bar {}", "typescript");
    expect(syms.find((s) => s.kind === "class" && s.name === "Bar")).toBeDefined();
  });

  it("extracts interface symbol", async () => {
    const syms = await extractSymbols(
      "interface Person { name: string }",
      "typescript"
    );
    expect(syms.find((s) => s.kind === "interface" && s.name === "Person")).toBeDefined();
  });

  it("extracts method inside class", async () => {
    const syms = await extractSymbols(
      "class X { greet() { return 1; } }",
      "typescript"
    );
    expect(syms.find((s) => s.kind === "method" && s.name === "greet")).toBeDefined();
  });

  it("records line ranges", async () => {
    const src = "function a() {\n  return 1;\n}";
    const syms = await extractSymbols(src, "typescript");
    const a = syms.find((s) => s.name === "a")!;
    expect(a.startLine).toBe(0);
    expect(a.endLine).toBe(2);
  });
});

describe("kb-code Python", () => {
  it("parses Python function", async () => {
    const syms = await extractSymbols("def foo():\n    pass", "python");
    expect(syms.find((s) => s.kind === "function" && s.name === "foo")).toBeDefined();
  });

  it("parses Python class", async () => {
    const syms = await extractSymbols("class Bar:\n    pass", "python");
    expect(syms.find((s) => s.kind === "class" && s.name === "Bar")).toBeDefined();
  });
});

describe("kb-code Go", () => {
  it("parses Go function", async () => {
    const syms = await extractSymbols("package main\nfunc Hello() {}", "go");
    expect(syms.find((s) => s.kind === "function" && s.name === "Hello")).toBeDefined();
  });
});

describe("kb-code JavaScript", () => {
  it("parses JS function", async () => {
    const syms = await extractSymbols("function f() {}", "javascript");
    expect(syms.find((s) => s.kind === "function" && s.name === "f")).toBeDefined();
  });
});
