// SPDX-License-Identifier: Apache-2.0
// @gate G20
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection } from "@orqenix/storage-sqlite";
import { runMigrations } from "@orqenix/storage-sqlite";
import {
  ReindexIndexer,
  Reindexer,
  type ReindexStats,
  type IndexEntry,
} from "@orqenix/reindex-incremental";
import { REINDEX_MIGRATIONS } from "@orqenix/reindex-incremental";
import { hashBytes, hashString } from "@orqenix/storage-diff";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

function createConn(): SqliteConnection {
  const conn = new SqliteConnection({ path: ":memory:" });
  runMigrations(conn, REINDEX_MIGRATIONS);
  return conn;
}

class G20 extends GateRunner {
  readonly id = "G20";
  readonly title = "Incremental Reindex";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G20.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G20.1", "reindex-incremental unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/reindex-incremental"),
          stdio: "pipe",
        });
      }),
      await this.check(
        "G20.2",
        "scanFull adds, updates, removes, marks unchanged correctly",
        async () => {
          const conn = createConn();
          const indexer = new ReindexIndexer(conn);
          const dir = await mkdtemp(join(tmpdir(), "g20-scan-"));
          const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
          try {
            await writeFile(join(dir, "a.txt"), "aaa");
            await writeFile(join(dir, "b.txt"), "bbb");
            await mkdir(join(dir, "sub"), { recursive: true });
            await writeFile(join(dir, "sub", "c.txt"), "ccc");
            const reindexer = new Reindexer({ indexer, scopeId: SCOPE, rootDir: dir });
            const s1 = await reindexer.scanFull();
            if (s1.filesAdded !== 3) throw new Error(`expected 3 added, got ${s1.filesAdded}`);
            if (s1.filesUpdated !== 0)
              throw new Error(`expected 0 updated, got ${s1.filesUpdated}`);
            if (s1.filesRemoved !== 0)
              throw new Error(`expected 0 removed, got ${s1.filesRemoved}`);
            if (s1.filesUnchanged !== 0)
              throw new Error(`expected 0 unchanged, got ${s1.filesUnchanged}`);
            const s2 = await reindexer.scanFull();
            if (s2.filesUnchanged !== 3)
              throw new Error(`expected 3 unchanged, got ${s2.filesUnchanged}`);
            await writeFile(join(dir, "a.txt"), "aaa-modified");
            const s3 = await reindexer.scanFull();
            if (s3.filesUpdated !== 1)
              throw new Error(`expected 1 updated, got ${s3.filesUpdated}`);
            if (s3.filesUnchanged !== 2)
              throw new Error(`expected 2 unchanged, got ${s3.filesUnchanged}`);
            await rm(join(dir, "b.txt"));
            const s4 = await reindexer.scanFull();
            if (s4.filesRemoved !== 1)
              throw new Error(`expected 1 removed, got ${s4.filesRemoved}`);
            if (s4.filesAdded !== 0) throw new Error(`expected 0 added, got ${s4.filesAdded}`);
          } finally {
            await rm(dir, { recursive: true, force: true, maxRetries: 3 });
            conn.close();
          }
        },
      ),
      await this.check("G20.3", "applyEvents is idempotent on re-apply", async () => {
        const conn = createConn();
        const indexer = new ReindexIndexer(conn);
        const dir = await mkdtemp(join(tmpdir(), "g20-events-"));
        const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        try {
          await writeFile(join(dir, "x.txt"), "hello");
          const reindexer = new Reindexer({ indexer, scopeId: SCOPE, rootDir: dir });
          await reindexer.scanFull();
          const stats = await reindexer.applyEvents([
            {
              kind: "change",
              path: join(dir, "x.txt"),
              relPath: "x.txt",
              timestamp: new Date().toISOString(),
            },
          ]);
          if (stats.filesUnchanged !== 1)
            throw new Error(`expected 1 unchanged on re-apply, got ${stats.filesUnchanged}`);
          if (stats.filesUpdated !== 0)
            throw new Error(`expected 0 updated on re-apply, got ${stats.filesUpdated}`);
        } finally {
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
          conn.close();
        }
      }),
      await this.check("G20.4", "ignores .git and node_modules paths", async () => {
        const conn = createConn();
        const indexer = new ReindexIndexer(conn);
        const dir = await mkdtemp(join(tmpdir(), "g20-ignore-"));
        const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        try {
          await mkdir(join(dir, ".git"), { recursive: true });
          await writeFile(join(dir, ".git", "HEAD"), "ref");
          await mkdir(join(dir, "node_modules", "pkg"), { recursive: true });
          await writeFile(join(dir, "node_modules", "pkg", "ix.json"), "{}");
          await writeFile(join(dir, "keep.txt"), "real");
          const reindexer = new Reindexer({ indexer, scopeId: SCOPE, rootDir: dir });
          const stats = await reindexer.scanFull();
          if (stats.filesScanned !== 1)
            throw new Error(`expected 1 scanned, got ${stats.filesScanned}`);
          if (stats.filesAdded !== 1) throw new Error(`expected 1 added, got ${stats.filesAdded}`);
        } finally {
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
          conn.close();
        }
      }),
      await this.check(
        "G20.5",
        "content_hash drives update detection (mtime alone insufficient)",
        async () => {
          const conn = createConn();
          const indexer = new ReindexIndexer(conn);
          const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
          try {
            indexer.upsert({
              relPath: "f.txt",
              scopeId: SCOPE,
              contentHash: hashString("original content"),
              sizeBytes: 16,
              modifiedAt: "2024-01-01T00:00:00.000Z",
            });
            const prior1 = indexer.get(SCOPE, "f.txt");
            indexer.upsert({
              relPath: "f.txt",
              scopeId: SCOPE,
              contentHash: prior1!.contentHash,
              sizeBytes: 16,
              modifiedAt: "2025-01-01T00:00:00.000Z",
            });
            if (indexer.count(SCOPE) !== 1)
              throw new Error("same hash should not create duplicate");
            indexer.upsert({
              relPath: "f.txt",
              scopeId: SCOPE,
              contentHash: hashString("changed content"),
              sizeBytes: 16,
              modifiedAt: "2025-01-01T00:00:00.000Z",
            });
            if (indexer.count(SCOPE) !== 1)
              throw new Error("different hash should update, not insert");
            const after = indexer.get(SCOPE, "f.txt");
            if (after!.contentHash !== hashString("changed content"))
              throw new Error("content hash was not updated");
          } finally {
            conn.close();
          }
        },
      ),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G20-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G20();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G20 crashed:", e);
  process.exit(2);
});
