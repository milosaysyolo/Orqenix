import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root: string;
let source: string;
let snaps: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "snap-e2e-"));
  source = join(root, "src");
  snaps = join(root, "snaps");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "config.json"), JSON.stringify({ v: 1 }));
});

afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("E2E 07 snapshot create verify restore", () => {
  it("snapshot create returns valid meta", async () => {
    const mod = await import("@orqenix/plugin-snapshot");
    const meta = await mod.createSnapshot(source, snaps, "baseline");
    expect(meta.fileCount).toBeGreaterThanOrEqual(1);
    expect(meta.contentHash).toHaveLength(64);
  });

  it("snapshot verify passes for fresh snapshot", async () => {
    const mod = await import("@orqenix/plugin-snapshot");
    const list = await mod.listSnapshots(snaps);
    expect(list.length).toBeGreaterThan(0);
    const meta = list[0]!;
    expect(await mod.verifySnapshot(snaps, meta.id)).toBe(true);
  });

  it("snapshot verify fails after tampering", async () => {
    const mod = await import("@orqenix/plugin-snapshot");
    const list = await mod.listSnapshots(snaps);
    const meta = list[0]!;
    await writeFile(join(snaps, meta.id, "config.json"), JSON.stringify({ v: 99 }));
    expect(await mod.verifySnapshot(snaps, meta.id)).toBe(false);
  });
});
