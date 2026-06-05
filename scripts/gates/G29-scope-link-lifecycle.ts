// SPDX-License-Identifier: Apache-2.0
// @gate G29
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  ScopeLinkStore,
  SCOPE_LINK_MIGRATIONS,
  LinkAlreadyExistsError,
  LinkStateError,
} from "@orqenix/scope-link";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

async function fresh(): Promise<{ dir: string; conn: SqliteConnection; store: ScopeLinkStore }> {
  const dir = await mkdtemp(join(tmpdir(), "g29-"));
  const conn = new SqliteConnection({ path: join(dir, "sl.sqlite") });
  runMigrations(conn, SCOPE_LINK_MIGRATIONS);
  const store = new ScopeLinkStore({ conn, localScopeId: A });
  return { dir, conn, store };
}

async function tear(dir: string, conn: SqliteConnection): Promise<void> {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G29 extends GateRunner {
  readonly id = "G29";
  readonly title = "Scope Link Lifecycle";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G29.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G29.1", "scope-link unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/scope-link"), stdio: "pipe" });
      }),
      await this.check("G29.2", "duplicate (local, remote, direction) rejected", async () => {
        const { dir, conn, store } = await fresh();
        try {
          store.create({ remoteScopeId: B, direction: "outbound" });
          let caught = false;
          try {
            store.create({ remoteScopeId: B, direction: "outbound" });
          } catch (e) {
            caught = e instanceof LinkAlreadyExistsError;
          }
          if (!caught) throw new Error("duplicate not rejected");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check(
        "G29.3",
        "state machine: pending -> active -> revoked, no other paths",
        async () => {
          const { dir, conn, store } = await fresh();
          try {
            store.create({ remoteScopeId: B, direction: "outbound" });
            store.updateStatus(B, "outbound", "active");
            store.updateStatus(B, "outbound", "revoked");
            let caught = false;
            try {
              store.updateStatus(B, "outbound", "active");
            } catch (e) {
              caught = e instanceof LinkStateError;
            }
            if (!caught) throw new Error("revoked -> active should be rejected");
          } finally {
            await tear(dir, conn);
          }
        },
      ),
      await this.check("G29.4", "recordSync requires active state", async () => {
        const { dir, conn, store } = await fresh();
        try {
          store.create({ remoteScopeId: B, direction: "outbound" });
          let caught = false;
          try {
            store.recordSync(B, "outbound");
          } catch (e) {
            caught = e instanceof LinkStateError;
          }
          if (!caught) throw new Error("recordSync on pending should fail");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G29.5", "self-link rejected at creation", async () => {
        const { dir, conn, store } = await fresh();
        try {
          let caught = false;
          try {
            store.create({ remoteScopeId: A, direction: "outbound" });
          } catch {
            caught = true;
          }
          if (!caught) throw new Error("self-link allowed");
        } finally {
          await tear(dir, conn);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G29-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G29();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G29 crashed:", e);
  process.exit(2);
});
