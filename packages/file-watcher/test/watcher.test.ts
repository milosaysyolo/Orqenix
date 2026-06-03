import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileWatcher, type FileEvent } from "../src";

describe("FileWatcher", () => {
  let dir: string;
  let watcher: FileWatcher | null;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-fw-"));
    watcher = null;
  });
  afterEach(async () => {
    if (watcher) await watcher.stop();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("detects add events", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await writeFile(join(dir, "hello.txt"), "hi");
    await new Promise((r) => setTimeout(r, 400));
    expect(batches.flat().some((e) => e.kind === "add" && e.relPath === "hello.txt")).toBe(true);
  });

  it("detects change events", async () => {
    await writeFile(join(dir, "x.txt"), "1");
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await new Promise((r) => setTimeout(r, 100));
    await writeFile(join(dir, "x.txt"), "2");
    await new Promise((r) => setTimeout(r, 400));
    expect(batches.flat().some((e) => e.kind === "change" && e.relPath === "x.txt")).toBe(true);
  });

  it("detects unlink events", async () => {
    await writeFile(join(dir, "y.txt"), "1");
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await new Promise((r) => setTimeout(r, 100));
    await unlink(join(dir, "y.txt"));
    await new Promise((r) => setTimeout(r, 400));
    expect(batches.flat().some((e) => e.kind === "unlink" && e.relPath === "y.txt")).toBe(true);
  });

  it("debounces multiple writes into one batch", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 200 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    for (let i = 0; i < 5; i++) {
      await writeFile(join(dir, `f${i}.txt`), "x");
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 500));
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allPaths = batches
      .flat()
      .map((e) => e.relPath)
      .sort();
    expect(allPaths).toEqual(["f0.txt", "f1.txt", "f2.txt", "f3.txt", "f4.txt"]);
  });

  it("ignores .git/ by default", async () => {
    await mkdir(join(dir, ".git"), { recursive: true });
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await writeFile(join(dir, ".git", "HEAD"), "ref");
    await new Promise((r) => setTimeout(r, 400));
    expect(batches.flat().some((e) => e.relPath.startsWith(".git/"))).toBe(false);
  });

  it("stop is idempotent", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    await watcher.start(async () => {});
    await watcher.stop();
    await watcher.stop();
    expect(watcher.status).toBe("stopped");
  });

  it("rejects double-start", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    await watcher.start(async () => {});
    await expect(watcher.start(async () => {})).rejects.toThrow(/already running/);
  });
});
