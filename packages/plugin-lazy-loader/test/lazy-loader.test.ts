import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LazyContentLoader } from "../src/index.js";

describe("LazyContentLoader", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orq-lazy-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a handle without loading content into memory", async () => {
    const path = join(dir, "x.txt");
    writeFileSync(path, "hello");
    const loader = new LazyContentLoader();
    const handle = await loader.createHandle(path);
    expect(handle.path).toBe(path);
    expect(handle.size).toBe(5);
    expect(handle.hash).toBeTruthy();
    expect(loader.stats().entries).toBe(0);
  });

  it("loads content via handle and caches it", async () => {
    const path = join(dir, "x.txt");
    writeFileSync(path, "hello world");
    const loader = new LazyContentLoader();
    const handle = await loader.createHandle(path);
    const content = await loader.load(handle);
    expect(content).toBe("hello world");
    expect(loader.stats().entries).toBe(1);
  });

  it("detects file modification via hash check", async () => {
    const path = join(dir, "x.txt");
    writeFileSync(path, "original");
    const loader = new LazyContentLoader();
    const handle = await loader.createHandle(path);
    appendFileSync(path, " modified");
    await expect(loader.load(handle)).rejects.toThrow(/modified/);
  });

  it("evicts LRU when cache exceeds capacity", async () => {
    const loader = new LazyContentLoader({
      enabled: true,
      cacheMaxBytes: 100,
      hashCheckOnRead: false,
    });
    for (let i = 0; i < 5; i++) {
      const p = join(dir, `f${i}.txt`);
      writeFileSync(p, "x".repeat(50));
      const h = await loader.createHandle(p);
      await loader.load(h);
    }
    expect(loader.stats().totalBytes).toBeLessThanOrEqual(100);
  });

  it("tokenizes file references into placeholders", async () => {
    const p1 = join(dir, "a.ts");
    const p2 = join(dir, "b.ts");
    writeFileSync(p1, "console.log(1)");
    writeFileSync(p2, "console.log(2)");
    const loader = new LazyContentLoader();
    const r = await loader.tokenizeReferences(`See ${p1} and ${p2}`, [p1, p2]);
    expect(r.transformed).toContain("[orqenix:lazy-ref");
    expect(r.handles.size).toBe(2);
  });
});
