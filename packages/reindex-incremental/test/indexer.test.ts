import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ReindexIndexer, Reindexer, REINDEX_MIGRATIONS, type IndexEntry } from "../src";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("ReindexIndexer + Reindexer", () => {
  let tmpRoot: string;
  let rootDir: string;
  let conn: SqliteConnection;
  let indexer: ReindexIndexer;
  let rx: Reindexer;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "orqenix-rx-"));
    rootDir = join(tmpRoot, "root");
    await mkdir(rootDir, { recursive: true });
    conn = new SqliteConnection({ path: join(tmpRoot, ".kb.sqlite") });
    runMigrations(conn, REINDEX_MIGRATIONS);
    indexer = new ReindexIndexer(conn);
    rx = new Reindexer({ indexer, scopeId: SCOPE, rootDir });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(tmpRoot, { recursive: true, force: true, maxRetries: 3 });
  });

  function entry(relPath: string, hash = "0".repeat(64)): IndexEntry {
    return {
      relPath,
      scopeId: SCOPE,
      contentHash: hash,
      sizeBytes: 10,
      modifiedAt: new Date().toISOString(),
    };
  }

  it("upsert + get + list", () => {
    indexer.upsert(entry("a.txt", "0".repeat(64)));
    indexer.upsert(entry("b.txt", "1".repeat(63) + "0"));
    expect(indexer.get(SCOPE, "a.txt")?.contentHash).toBe("0".repeat(64));
    expect(indexer.list(SCOPE).map((e) => e.relPath)).toEqual(["a.txt", "b.txt"]);
    expect(indexer.count(SCOPE)).toBe(2);
  });

  it("upsert is idempotent on same hash", () => {
    indexer.upsert(entry("a.txt"));
    indexer.upsert(entry("a.txt"));
    expect(indexer.count(SCOPE)).toBe(1);
  });

  it("upsert updates hash on conflict", () => {
    indexer.upsert(entry("a.txt", "0".repeat(64)));
    indexer.upsert(entry("a.txt", "1".repeat(63) + "0"));
    expect(indexer.get(SCOPE, "a.txt")?.contentHash).toBe("1".repeat(63) + "0");
  });

  it("remove returns true only when row existed", () => {
    indexer.upsert(entry("a.txt"));
    expect(indexer.remove(SCOPE, "a.txt")).toBe(true);
    expect(indexer.remove(SCOPE, "a.txt")).toBe(false);
  });

  it("scanFull adds new files", async () => {
    await writeFile(join(rootDir, "one.md"), "hello");
    await writeFile(join(rootDir, "two.md"), "world");
    const stats = await rx.scanFull();
    expect(stats.filesAdded).toBe(2);
    expect(stats.filesScanned).toBe(2);
    expect(indexer.count(SCOPE)).toBe(2);
  });

  it("scanFull detects updates by content hash", async () => {
    await writeFile(join(rootDir, "one.md"), "hello");
    await rx.scanFull();
    await new Promise((r) => setTimeout(r, 10));
    await writeFile(join(rootDir, "one.md"), "hello world");
    const stats = await rx.scanFull();
    expect(stats.filesUpdated).toBe(1);
    expect(stats.filesAdded).toBe(0);
  });

  it("scanFull marks unchanged files", async () => {
    await writeFile(join(rootDir, "one.md"), "hello");
    await rx.scanFull();
    const stats = await rx.scanFull();
    expect(stats.filesUnchanged).toBe(1);
  });

  it("scanFull removes deleted files", async () => {
    await writeFile(join(rootDir, "one.md"), "hello");
    await rx.scanFull();
    await unlink(join(rootDir, "one.md"));
    const stats = await rx.scanFull();
    expect(stats.filesRemoved).toBe(1);
    expect(indexer.count(SCOPE)).toBe(0);
  });

  it("scanFull ignores .git/ and node_modules/", async () => {
    await mkdir(join(rootDir, ".git"), { recursive: true });
    await mkdir(join(rootDir, "node_modules", "x"), { recursive: true });
    await writeFile(join(rootDir, ".git", "HEAD"), "ref");
    await writeFile(join(rootDir, "node_modules", "x", "package.json"), "{}");
    await writeFile(join(rootDir, "real.txt"), "real");
    const stats = await rx.scanFull();
    expect(stats.filesAdded).toBe(1);
    expect(indexer.get(SCOPE, "real.txt")).not.toBeNull();
  });

  it("applyEvents handles add/change/unlink", async () => {
    await writeFile(join(rootDir, "a.txt"), "v1");
    const r1 = await rx.applyEvents([
      {
        kind: "add",
        path: join(rootDir, "a.txt"),
        relPath: "a.txt",
        timestamp: new Date().toISOString(),
      },
    ]);
    expect(r1.filesAdded).toBe(1);
    await writeFile(join(rootDir, "a.txt"), "v2");
    const r2 = await rx.applyEvents([
      {
        kind: "change",
        path: join(rootDir, "a.txt"),
        relPath: "a.txt",
        timestamp: new Date().toISOString(),
      },
    ]);
    expect(r2.filesUpdated).toBe(1);
    await unlink(join(rootDir, "a.txt"));
    const r3 = await rx.applyEvents([
      {
        kind: "unlink",
        path: join(rootDir, "a.txt"),
        relPath: "a.txt",
        timestamp: new Date().toISOString(),
      },
    ]);
    expect(r3.filesRemoved).toBe(1);
    expect(indexer.count(SCOPE)).toBe(0);
  });

  it("applyEvents ignores .git paths", async () => {
    await mkdir(join(rootDir, ".git"), { recursive: true });
    await writeFile(join(rootDir, ".git", "HEAD"), "x");
    const r = await rx.applyEvents([
      {
        kind: "add",
        path: join(rootDir, ".git", "HEAD"),
        relPath: ".git/HEAD",
        timestamp: new Date().toISOString(),
      },
    ]);
    expect(r.filesScanned).toBe(0);
  });
});
