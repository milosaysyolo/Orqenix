import { describe, it, expect } from "vitest";
import { KnowledgeQueryEngine } from "./index.js";

const stubKB = (kind: string) => ({
  query: async (_q: string, _topK?: number) => [
    { id: `${kind}-1`, text: `text from ${kind}`, score: 0.9, path: "", heading: "", name: `name-${kind}`,kind: "function" },
  ],
  semanticSearch: async (_topK?: number) => [
    { id: `${kind}-1`, title: "title", body: "body", type: "adr", scopeId: "s1", enforcement: "soft" as const, confidence: 0.9 },
  ],
});

describe("KnowledgeQueryEngine", () => {
  it("aggregates results across KBs", async () => {
    const eng = new KnowledgeQueryEngine(
      stubKB("doc") as any,
      stubKB("code") as any,
      stubKB("decision") as any,
    );
    const r = await eng.query({ text: "x", scope: "s1", topK: 10 });
    expect(r.map((x) => x.kind).sort()).toEqual(["code", "decision", "doc"]);
  });

  it("respects topK", async () => {
    const eng = new KnowledgeQueryEngine(
      stubKB("doc") as any,
      stubKB("code") as any,
      stubKB("decision") as any,
    );
    const r = await eng.query({ text: "x", scope: "s1", topK: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("filters by kbs param", async () => {
    const eng = new KnowledgeQueryEngine(
      stubKB("doc") as any,
      stubKB("code") as any,
      stubKB("decision") as any,
    );
    const r = await eng.query({ text: "x", scope: "s1", kbs: ["docs"], topK: 10 });
    expect(r.every((x) => x.kind === "doc")).toBe(true);
  });

  it("applies token cap", async () => {
    const eng = new KnowledgeQueryEngine(
      stubKB("doc") as any,
      stubKB("code") as any,
      stubKB("decision") as any,
    );
    const r = await eng.query({ text: "x", scope: "s1", topK: 10, maxTokens: 5 });
    expect(r.length).toBeLessThanOrEqual(1);
  });
});
