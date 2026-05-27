import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSnapshot,
  listSnapshots,
  deleteSnapshot,
  verifySnapshot,
} from "../src/index.js";

let dir: string;
let source: string;
let snapDir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "snap-test-"));
  source = join(dir, "src");
  snapDir = join(dir, "snaps");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "a.txt"), "hello");
  await mkdir(join(source, "sub"), { recursive: true });
  await writeFile(join(source, "sub", "b.txt"), "world");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("snapshot create/list", () => {
  it("creates snapshot with meta", async () => {
    const meta = await createSnapshot(source, snapDir, "test");
    expect(meta.fileCount).toBe(2);
    expect(meta.totalBytes).toBe(10);
    expect(meta.contentHash).toHaveLength(64);
    expect(meta.label).toBe("test");
  });

  it("listSnapshots returns newest first", async () => {
    await createSnapshot(source, snapDir);
    await new Promise((r) => setTimeout(r, 5));
    await createSnapshot(source, snapDir);
    const list = await listSnapshots(snapDir);
    expect(list).toHaveLength(2);
    expect(list[0]!.createdAt).toBeGreaterThanOrEqual(list[1]!.createdAt);
  });

  it("listSnapshots returns empty on missing dir", async () => {
    expect(await listSnapshots(join(dir, "nope"))).toEqual([]);
  });

  it("deleteSnapshot removes directory", async () => {
    const meta = await createSnapshot(source, snapDir);
    expect(await deleteSnapshot(snapDir, meta.id)).toBe(true);
    expect(await deleteSnapshot(snapDir, meta.id)).toBe(false);
  });

  it("verifySnapshot passes on intact snapshot", async () => {
    const meta = await createSnapshot(source, snapDir);
    expect(await verifySnapshot(snapDir, meta.id)).toBe(true);
  });

  it("verifySnapshot fails on tampered snapshot", async () => {
    const meta = await createSnapshot(source, snapDir);
    await writeFile(join(snapDir, meta.id, "a.txt"), "tampered");
    expect(await verifySnapshot(snapDir, meta.id)).toBe(false);
  });
});
