// SPDX-License-Identifier: Apache-2.0
// @gate G31
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  WorkspaceStore,
  WORKSPACE_MIGRATIONS,
  OwnerRemovalError,
  MembershipAlreadyExistsError,
} from "@orqenix/workspace";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

async function fresh(): Promise<{ dir: string; conn: SqliteConnection; store: WorkspaceStore }> {
  const dir = await mkdtemp(join(tmpdir(), "g31-"));
  const conn = new SqliteConnection({ path: join(dir, "ws.sqlite") });
  runMigrations(conn, WORKSPACE_MIGRATIONS);
  return { dir, conn, store: new WorkspaceStore({ conn }) };
}
async function tear(dir: string, conn: SqliteConnection): Promise<void> {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G31 extends GateRunner {
  readonly id = "G31";
  readonly title = "Workspace Membership";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G31.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G31.1", "workspace unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/workspace"), stdio: "pipe" });
      }),
      await this.check("G31.2", "create inserts owner membership atomically", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const w = store.create({ name: "team", ownerScopeId: A });
          const mems = store.listMembers(w.id as any);
          if (mems.length !== 1 || mems[0].role !== "owner") throw new Error("owner not created");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G31.3", "addMember rejects duplicates", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const w = store.create({ name: "team", ownerScopeId: A });
          store.addMember(w.id as any, B, "contributor");
          let caught = false;
          try {
            store.addMember(w.id as any, B, "observer");
          } catch (e) {
            caught = e instanceof MembershipAlreadyExistsError;
          }
          if (!caught) throw new Error("duplicate not rejected");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G31.4", "removeMember refuses owner", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const w = store.create({ name: "team", ownerScopeId: A });
          let caught = false;
          try {
            store.removeMember(w.id as any, A);
          } catch (e) {
            caught = e instanceof OwnerRemovalError;
          }
          if (!caught) throw new Error("owner removed");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G31.5", "transferOwnership swaps roles atomically", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const w = store.create({ name: "team", ownerScopeId: A });
          store.addMember(w.id as any, B, "contributor");
          const w2 = store.transferOwnership(w.id as any, B);
          if (w2.ownerScopeId !== B) throw new Error("owner not transferred");
          if (store.getMember(w.id as any, A).role !== "contributor")
            throw new Error("previous owner not demoted");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G31.6", "delete cascades to memberships", async () => {
        const { dir, conn, store } = await fresh();
        try {
          const w = store.create({ name: "team", ownerScopeId: A });
          store.addMember(w.id as any, B, "contributor");
          store.delete(w.id as any);
          if (store.listForScope(A).length !== 0) throw new Error("cascade failed");
          if (store.listForScope(B).length !== 0) throw new Error("cascade failed for B");
        } finally {
          await tear(dir, conn);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G31-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G31();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G31 crashed:", e);
  process.exit(2);
});
