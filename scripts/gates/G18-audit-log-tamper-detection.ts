// SPDX-License-Identifier: Apache-2.0
// @gate G18
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { AuditLogStore, AUDIT_LOG_MIGRATIONS, AuditChainBrokenError } from "@orqenix/audit-log";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function fresh() {
  const dir = await mkdtemp(join(tmpdir(), "g18-"));
  const conn = new SqliteConnection({ path: join(dir, "a.sqlite") });
  runMigrations(conn, AUDIT_LOG_MIGRATIONS);
  return { dir, conn, store: new AuditLogStore({ conn, scopeId: A }) };
}
async function tear(dir: string, conn: SqliteConnection) {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G18 extends GateRunner {
  readonly id = "G18";
  readonly title = "Audit Log Tamper Detection";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G18.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G18.1", "audit-log unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/audit-log"), stdio: "pipe" });
      }),
      await this.check("G18.2", "verifyChain passes on 50-entry untampered log", async () => {
        const { dir, conn, store } = await fresh();
        try {
          for (let i = 0; i < 50; i++) {
            store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: { i } });
          }
          const r = store.verifyChain();
          if (r.entriesChecked !== 50) throw new Error(`expected 50, got ${r.entriesChecked}`);
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G18.3", "30 random payload tampers all detected", async () => {
        for (let iter = 0; iter < 30; iter++) {
          const { dir, conn, store } = await fresh();
          try {
            for (let i = 0; i < 10; i++)
              store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: { i } });
            const target = 1 + Math.floor(Math.random() * 10);
            conn
              .prepare(
                `UPDATE audit_log_entries SET payload_json = '{"tampered":${iter}}' WHERE rowid = ?`,
              )
              .run(target);
            let caught = false;
            try {
              store.verifyChain();
            } catch (e) {
              caught = e instanceof AuditChainBrokenError;
            }
            if (!caught) throw new Error(`tamper at rowid ${target} (iter ${iter}) not caught`);
          } finally {
            await tear(dir, conn);
          }
        }
      }),
      await this.check("G18.4", "broken prevHash linkage detected", async () => {
        const { dir, conn, store } = await fresh();
        try {
          for (let i = 0; i < 5; i++)
            store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: { i } });
          conn
            .prepare(`UPDATE audit_log_entries SET prev_hash = '${"f".repeat(64)}' WHERE rowid = 3`)
            .run();
          let caught = false;
          try {
            store.verifyChain();
          } catch (e) {
            caught = e instanceof AuditChainBrokenError;
          }
          if (!caught) throw new Error("broken prevHash not caught");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G18.5", "two scopes have independent chains", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
          const storeB = new AuditLogStore({ conn, scopeId: B });
          store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
          storeB.append({ actorScopeId: B, eventKind: "scope_initialized", payload: {} });
          store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: {} });
          storeB.append({ actorScopeId: B, eventKind: "mesh_query_run", payload: {} });
          if (store.verifyChain().entriesChecked !== 2) throw new Error("A chain wrong");
          if (storeB.verifyChain().entriesChecked !== 2) throw new Error("B chain wrong");
        } finally {
          await tear(dir, conn);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G18-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G18();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G18 crashed:", e);
  process.exit(2);
});
