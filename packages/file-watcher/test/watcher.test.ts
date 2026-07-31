import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileWatcher, type FileEvent } from "../src";

// Node fs.watch on Windows asserts (!_wcsnicmp) when the watched dir is
// removed during teardown. Skip the flaky native crash on win32.
const RUN = process.platform === "win32" ? it.skip : it;

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

  RUN("detects add events", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await writeFile(join(dir, "hello.txt"), "hi");
    await new Promise((r) => setTimeout(r, 600));
    expect(batches.flat().some((e) => e.kind === "add" && e.relPath === "hello.txt")).toBe(true);
  });

  RUN("detects change events", async () => {
    await writeFile(join(dir, "x.txt"), "1");
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await new Promise((r) => setTimeout(r, 100));
    await writeFile(join(dir, "x.txt"), "2");
    await new Promise((r) => setTimeout(r, 600));
    expect(batches.flat().some((e) => e.kind === "change" && e.relPath === "x.txt")).toBe(true);
  });

  RUN("detects unlink events", async () => {
    await writeFile(join(dir, "y.txt"), "1");
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    await new Promise((r) => setTimeout(r, 100));
    await unlink(join(dir, "y.txt"));
    await new Promise((r) => setTimeout(r, 600));
    expect(batches.flat().some((e) => e.kind === "unlink" && e.relPath === "y.txt")).toBe(true);
  });

  RUN("debounces multiple writes into one batch", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 400 });
    const batches: FileEvent[][] = [];
    await watcher.start(async (b) => {
      batches.push(b);
    });
    for (let i = 0; i < 5; i++) {
      await writeFile(join(dir, `f${i}.txt`), "x");
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 1000));
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allPaths = batches
      .flat()
      .map((e) => e.relPath)
      .sort();
    expect(allPaths).toEqual(["f0.txt", "f1.txt", "f2.txt", "f3.txt", "f4.txt"]);
  });

  RUN("ignores .git/ by default", async () => {
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

  RUN("stop is idempotent", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    await watcher.start(async () => {});
    await watcher.stop();
    await watcher.stop();
    expect(watcher.status).toBe("stopped");
  });

  RUN("rejects double-start", async () => {
    watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
    await watcher.start(async () => {});
    await expect(watcher.start(async () => {})).rejects.toThrow(/already running/);
  });
});
