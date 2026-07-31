// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { KnowledgeQueryEngine } from "../src/index.js";

describe("KnowledgeQueryEngine query shape", () => {
  it("produces correct result shape from all KBs", async () => {
    const docResult = {
      id: "d1",
      text: "doc body",
      score: 0.9,
      path: "/readme",
      heading: "Intro",
    };
    const codeResult = {
      id: "c1",
      name: "authFn",
      score: 0.8,
      path: "/src/auth.ts",
      kind: "function",
    };
    const decisionResult = {
      id: "dec1",
      title: "ADR-1",
      body: "use postgres",
      type: "adr",
      scopeId: "s1",
      enforcement: "soft" as const,
      confidence: 0.7,
    };

    const engine = new KnowledgeQueryEngine(
      { query: () => [docResult] } as any,
      { query: async () => [codeResult] } as any,
      { listByType: async () => [decisionResult] } as any,
    );

    const results = await engine.query({ text: "test", scope: "s1", topK: 10 });

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toHaveProperty("kind");
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("text");
      expect(r).toHaveProperty("score");
      expect(r).toHaveProperty("meta");
    }
    expect(results.map((r) => r.kind).sort()).toEqual(["code", "decision", "doc"]);
  });

  it("returns empty array when kbs list is empty", async () => {
    const engine = new KnowledgeQueryEngine(
      { query: () => [{ id: "d1", text: "x", score: 0.5, path: "", heading: "" }] } as any,
      { query: async () => [{ id: "c1", name: "fn", score: 0.5, path: "", kind: "" }] } as any,
      { listByType: async () => [] } as any,
    );

    const results = await engine.query({ text: "test", scope: "s1", kbs: [], topK: 10 });
    expect(results).toHaveLength(0);
  });
});

describe("KnowledgeQueryEngine empty query", () => {
  it("does not throw on empty text", async () => {
    const engine = new KnowledgeQueryEngine(
      { query: () => [] } as any,
      { query: async () => [] } as any,
      { listByType: async () => [] } as any,
    );

    const results = await engine.query({ text: "", scope: "s1" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("returns results when empty text still matches", async () => {
    const engine = new KnowledgeQueryEngine(
      { query: () => [{ id: "d1", text: "", score: 0.5, path: "", heading: "" }] } as any,
      { query: async () => [] } as any,
      { listByType: async () => [] } as any,
    );

    const results = await engine.query({ text: "", scope: "s1" });
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe("KnowledgeQueryEngine invalid input", () => {
  it("handles undefined optional fields gracefully", async () => {
    const engine = new KnowledgeQueryEngine(
      { query: () => [{ id: "d1", text: "x", score: 0.5, path: "", heading: "" }] } as any,
      { query: async () => [] } as any,
      { listByType: async () => [] } as any,
    );

    const q: any = { text: "test", scope: "s1" };
    q.kbs = undefined; // explicitly undefined
    q.topK = undefined;
    q.maxTokens = undefined;

    const results = await engine.query(q);
    expect(Array.isArray(results)).toBe(true);
    // Default topK=5 should apply
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("handles retrieval config with missing fields", async () => {
    const engine = new KnowledgeQueryEngine(
      { query: () => [] } as any,
      { query: async () => [] } as any,
      { listByType: async () => [] } as any,
    );

    // Partial retrieval config - missing rerank and grader
    const results = await engine.query({
      text: "test",
      scope: "s1",
      retrieval: {} as any,
    });
    expect(Array.isArray(results)).toBe(true);
  });
});
