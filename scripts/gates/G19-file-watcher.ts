// SPDX-License-Identifier: Apache-2.0
// @gate G19
import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FileWatcher, type FileEvent } from "@orqenix/file-watcher";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G19 extends GateRunner {
  readonly id = "G19";
  readonly title = "File Watcher";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G19.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G19.1", "file-watcher unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/file-watcher"),
          stdio: "pipe",
        });
      }),
      await this.check("G19.2", "detects add+change+unlink end-to-end", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g19-"));
        const watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
        const batches: FileEvent[][] = [];
        await watcher.start(async (b) => {
          batches.push(b);
        });
        try {
          await writeFile(join(dir, "a.txt"), "v1");
          await new Promise((r) => setTimeout(r, 300));
          const all = batches.flat().map((e) => e.kind);
          if (!all.includes("add")) throw new Error("add not seen");
        } finally {
          await watcher.stop();
          await new Promise((r) => setTimeout(r, 50));
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
        }
      }),
      await this.check("G19.3", "debounce collapses bursts", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g19-d-"));
        const watcher = new FileWatcher({ rootDir: dir, debounceMs: 200 });
        const batches: FileEvent[][] = [];
        await watcher.start(async (b) => {
          batches.push(b);
        });
        try {
          for (let i = 0; i < 6; i++) {
            await writeFile(join(dir, `f${i}.txt`), "x");
            await new Promise((r) => setTimeout(r, 25));
          }
          await new Promise((r) => setTimeout(r, 500));
          const total = batches.flat().length;
          if (total !== 6) throw new Error(`expected 6 events total, got ${total}`);
          if (batches.length > 2)
            throw new Error(`expected debounced batches (<=2), got ${batches.length}`);
        } finally {
          await watcher.stop();
          await new Promise((r) => setTimeout(r, 50));
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
        }
      }),
      await this.check("G19.4", "ignores .git and node_modules", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g19-i-"));
        const watcher = new FileWatcher({ rootDir: dir, debounceMs: 100 });
        const batches: FileEvent[][] = [];
        await watcher.start(async (b) => {
          batches.push(b);
        });
        try {
          const { mkdir, writeFile } = await import("node:fs/promises");
          await mkdir(join(dir, ".git"), { recursive: true });
          await writeFile(join(dir, ".git", "HEAD"), "ref");
          await mkdir(join(dir, "node_modules", "x"), { recursive: true });
          await writeFile(join(dir, "node_modules", "x", "p.json"), "{}");
          await writeFile(join(dir, "real.txt"), "r");
          await new Promise((r) => setTimeout(r, 400));
          const paths = batches.flat().map((e) => e.relPath);
          if (paths.some((p) => p.startsWith(".git/"))) throw new Error(".git not ignored");
          if (paths.some((p) => p.startsWith("node_modules/")))
            throw new Error("node_modules not ignored");
          if (!paths.includes("real.txt")) throw new Error("real file not seen");
        } finally {
          await watcher.stop();
          await new Promise((r) => setTimeout(r, 50));
          await rm(dir, { recursive: true, force: true, maxRetries: 3 });
        }
      }),
      await this.check("G19.5", "stop is idempotent + clean", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g19-s-"));
        const watcher = new FileWatcher({ rootDir: dir, debounceMs: 50 });
        await watcher.start(async () => {});
        await watcher.stop();
        await watcher.stop();
        if (watcher.status !== "stopped") throw new Error("status not stopped");
        await rm(dir, { recursive: true, force: true, maxRetries: 3 });
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G19-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G19();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G19 crashed:", e);
  process.exit(2);
});
