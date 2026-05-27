import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KnowledgeQueryEngine } from "../index.js";

describe("kb-query behavior tests", () => {
  let dbPath: string;
  let engine: KnowledgeQueryEngine;

  beforeEach(async () => {
    dbPath = mkdtempSync(join(tmpdir(), "kb-query-test-"));
    const mockDocs = { query: async () => [] } as any;
    const mockCode = { query: async () => [] } as any;
    const mockDecisions = { semanticSearch: async () => [] } as any;
    engine = new KnowledgeQueryEngine(mockDocs, mockCode, mockDecisions);
  });

  afterEach(() => {
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("query returns results", async () => {
    const results = await engine.query({ text: "test", scope: "test" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("query with topK limit", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      topK: 3,
    });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("query with dense retrieval mode", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      retrieval: { mode: "dense", rerank: false, grader: false },
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("query with sparse retrieval mode", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      retrieval: { mode: "sparse", rerank: false, grader: false },
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("query with hybrid retrieval mode", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      retrieval: { mode: "hybrid", rerank: false, grader: false },
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("rerank option is accepted", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      retrieval: { mode: "hybrid", rerank: true, grader: false },
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("grade option is accepted", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      retrieval: { mode: "hybrid", rerank: false, grader: true },
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("maxTokens option is accepted", async () => {
    const results = await engine.query({
      text: "test",
      scope: "test",
      maxTokens: 500,
    });
    expect(Array.isArray(results)).toBe(true);
  });

  it("empty query returns empty results", async () => {
    const results = await engine.query({ text: "", scope: "test" });
    expect(results.length).toBe(0);
  });
});
