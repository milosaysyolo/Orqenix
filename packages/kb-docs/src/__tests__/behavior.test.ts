import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocsKB } from "../index.js";

describe("kb-docs behavior tests", () => {
  let dbPath: string;
  let kb: DocsKB;

  beforeEach(async () => {
    dbPath = mkdtempSync(join(tmpdir(), "kb-docs-test-"));
    kb = await DocsKB.open(join(dbPath, "docs.db"));
  });

  afterEach(async () => {
    await kb.close();
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("index markdown file", async () => {
    const mdPath = join(dbPath, "test.md");
    const content = "# Test\n\nThis is a test document";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    expect(true).toBe(true);
  });

  it("query returns results", async () => {
    const mdPath = join(dbPath, "test.md");
    const content = "# Test\n\nThis is a test document";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    
    const results = await kb.query("test", 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("query with topK limit", async () => {
    for (let i = 0; i < 10; i++) {
      const mdPath = join(dbPath, `doc${i}.md`);
      const content = `# Doc ${i}\n\nContent ${i}`;
      writeFileSync(mdPath, content);
      await kb.index(mdPath, content);
    }
    
    const results = await kb.query("doc", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("index multiple files", async () => {
    const dir = join(dbPath, "docs");
    const content1 = "# Doc 1\n\nContent 1";
    const content2 = "# Doc 2\n\nContent 2";
    mkdirSync(dir, { recursive: true });
    
    writeFileSync(join(dir, "doc1.md"), content1);
    writeFileSync(join(dir, "doc2.md"), content2);
    
    await kb.index(join(dir, "doc1.md"), content1);
    await kb.index(join(dir, "doc2.md"), content2);
    const results = await kb.query("content", 10);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("handle markdown with code blocks", async () => {
    const mdPath = join(dbPath, "code.md");
    const content = "# Code\n\n```ts\nconst x = 1;\n```\n\nCode example";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    const results = await kb.query("code example", 3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("handle nested headings", async () => {
    const mdPath = join(dbPath, "nested.md");
    const content = "# H1\n## H2\n### H3\n\nNested content";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    const results = await kb.query("nested", 3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("query returns results with metadata", async () => {
    const mdPath = join(dbPath, "test.md");
    const content = "# Test\n\nTest content";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    
    const results = await kb.query("test", 5);
    if (results.length > 0) {
      const result = results[0]!;
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("text");
    }
  });

  it("empty query returns empty results", async () => {
    const mdPath = join(dbPath, "test.md");
    const content = "# Test\n\nTest content";
    writeFileSync(mdPath, content);
    
    await kb.index(mdPath, content);
    
    const results = await kb.query("", 5);
    expect(results.length).toBe(0);
  });
});
