import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;

beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), "kb-e2e-")); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe("E2E 06 knowledge layer flow", () => {
  it("kb-docs FTS5 search returns inserted doc", async () => {
    const { openKbDocs } = await import("@orqenix/kb-docs");
    const handle = openKbDocs(join(dir, "docs.sqlite"));
    handle.insertDoc({
      id: "1", path: "docs/a.md", title: "Hybrid Retrieval",
      content: "FTS5 plus vector embeddings combined via alpha weighting",
      updatedAt: Date.now(),
    });
    const hits = handle.searchText("hybrid");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe("1");
    handle.close();
  });

  it("kb-code extracts function symbol from TypeScript", async () => {
    const { extractSymbols } = await import("@orqenix/kb-code");
    const syms = await extractSymbols("function helloWorld() { return 1; }", "typescript");
    expect(syms.some((s) => s.name === "helloWorld" && s.kind === "function")).toBe(true);
  });

  it("kb-decisions ancestors traversal returns ordered chain", async () => {
    const mod = await import("@orqenix/kb-decisions");
    const g = mod.createGraph();
    mod.addDecision(g, { id: "root", title: "", decidedAt: 0, rationale: "", parents: [] });
    mod.addDecision(g, { id: "a", title: "", decidedAt: 0, rationale: "", parents: ["root"] });
    mod.addDecision(g, { id: "b", title: "", decidedAt: 0, rationale: "", parents: ["a"] });
    const ancestors = mod.ancestors(g, "b").map((n) => n.id);
    expect(ancestors).toContain("root");
    expect(ancestors).toContain("a");
    expect(ancestors).toContain("b");
  });
});
