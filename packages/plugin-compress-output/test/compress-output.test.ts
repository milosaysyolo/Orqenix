import { describe, it, expect } from "vitest";
import {
  compressFileList,
  compressJson,
  compressLogs,
  compressSearchResults,
  detectOutputType,
  estimateTokens,
} from "../src/index.js";

describe("estimateTokens", () => {
  it("estimates by character count", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

describe("detectOutputType", () => {
  it("detects file_list", () => {
    expect(detectOutputType(["a.ts", "src/b.ts"])).toBe("file_list");
  });
  it("detects search_results", () => {
    expect(detectOutputType([{ score: 0.9, text: "x" }])).toBe("search_results");
  });
  it("detects diff", () => {
    expect(detectOutputType("diff --git a/x b/x\n@@ -1 +1 @@\n-old\n+new")).toBe("diff");
  });
  it("detects logs", () => {
    const log = [
      "2026-01-01 INFO x",
      "2026-01-01 INFO y",
      "2026-01-01 INFO z",
      "2026-01-01 INFO w",
      "2026-01-01 INFO v",
      "2026-01-01 INFO u",
    ].join("\n");
    expect(detectOutputType(log)).toBe("logs");
  });
  it("returns unknown for plain text", () => {
    expect(detectOutputType("hello")).toBe("unknown");
  });
});

describe("compressFileList", () => {
  it("returns small lists unchanged", () => {
    const files = ["a.ts", "b.ts"];
    expect(compressFileList(files)).toContain("a.ts");
  });
  it("groups large lists by directory prefix", () => {
    const files = Array.from({ length: 100 }, (_, i) => `src/foo/file${i}.ts`);
    const r = compressFileList(files);
    expect(r).toContain("100 total");
    expect(r).toContain("src/foo");
  });
});

describe("compressLogs", () => {
  it("preserves error lines verbatim", () => {
    const log = "2026-01-01 INFO ok\n2026-01-01 ERROR boom!\n2026-01-01 INFO ok";
    const r = compressLogs(log);
    expect(r).toContain("ERRORS");
    expect(r).toContain("boom!");
  });
  it("deduplicates similar lines", () => {
    const log = Array.from({ length: 50 }, (_, i) => `2026-01-01 INFO request ${i}`).join("\n");
    const r = compressLogs(log);
    expect(r).toContain("[×50]");
  });
});

describe("compressJson", () => {
  it("compresses large arrays to first 3 + last", () => {
    const arr = Array.from({ length: 100 }, (_, i) => ({ i }));
    const r = compressJson(arr);
    expect(r).toContain("_orqenix_compressed");
    expect(r).toContain("first3");
    expect(r).toContain('"total": 100');
  });
  it("provides schema for objects", () => {
    const r = compressJson({ a: 1, b: "x", c: true });
    expect(r).toContain("schema");
    expect(r).toContain("number");
    expect(r).toContain("string");
    expect(r).toContain("boolean");
  });
});

describe("compressSearchResults", () => {
  it("returns top 5 + total + score range", () => {
    const results = Array.from({ length: 20 }, (_, i) => ({ score: 1 - i / 20, item: i }));
    const r = compressSearchResults(results);
    expect(r).toContain('"total": 20');
    expect(r).toContain("top5");
    expect(r).toContain("score_range");
  });
});
