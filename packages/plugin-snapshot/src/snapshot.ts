import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, stat, rm, copyFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface SnapshotMeta {
  id: string;
  createdAt: number;
  label?: string;
  fileCount: number;
  totalBytes: number;
  contentHash: string;
}

async function walk(dir: string, base: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else if (e.isFile()) out.push(relative(base, full));
  }
  return out;
}

export async function createSnapshot(
  sourceDir: string,
  snapshotsDir: string,
  label?: string
): Promise<SnapshotMeta> {
  const ts = Date.now();
  const id = `snap-${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const target = join(snapshotsDir, id);
  await mkdir(target, { recursive: true });

  const files = await walk(sourceDir, sourceDir);
  let totalBytes = 0;
  const hash = createHash("sha256");

  for (const rel of files.sort()) {
    const src = join(sourceDir, rel);
    const dst = join(target, rel);
    await mkdir(join(dst, ".."), { recursive: true });
    await copyFile(src, dst);
    const buf = await readFile(src);
    totalBytes += buf.length;
    hash.update(rel);
    hash.update(buf);
  }

  const meta: SnapshotMeta = {
    id,
    createdAt: ts,
    label,
    fileCount: files.length,
    totalBytes,
    contentHash: hash.digest("hex"),
  };
  await writeFile(join(target, "meta.json"), JSON.stringify(meta, null, 2));
  return meta;
}

export async function listSnapshots(
  snapshotsDir: string
): Promise<SnapshotMeta[]> {
  try {
    const entries = await readdir(snapshotsDir, { withFileTypes: true });
    const out: SnapshotMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const raw = await readFile(join(snapshotsDir, e.name, "meta.json"), "utf8");
        out.push(JSON.parse(raw));
      } catch {
        // skip corrupted
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteSnapshot(
  snapshotsDir: string,
  id: string
): Promise<boolean> {
  const path = join(snapshotsDir, id);
  try {
    await stat(path);
    await rm(path, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function verifySnapshot(
  snapshotsDir: string,
  id: string
): Promise<boolean> {
  const path = join(snapshotsDir, id);
  const meta: SnapshotMeta = JSON.parse(
    await readFile(join(path, "meta.json"), "utf8")
  );
  const files = (await walk(path, path)).filter((f) => f !== "meta.json");
  if (files.length !== meta.fileCount) return false;
  const hash = createHash("sha256");
  for (const rel of files.sort()) {
    const buf = await readFile(join(path, rel));
    hash.update(rel);
    hash.update(buf);
  }
  return hash.digest("hex") === meta.contentHash;
}
