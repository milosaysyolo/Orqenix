// SPDX-License-Identifier: Apache-2.0
// @gate G17
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from "@orqenix/scope-link";
import { WorkspaceStore, WORKSPACE_MIGRATIONS } from "@orqenix/workspace";
import { AuditLogStore, AUDIT_LOG_MIGRATIONS } from "@orqenix/audit-log";
import { DetachPlanner, DetachExecutor, InvalidConfirmationError } from "@orqenix/detach";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const VITEST_BIN = join(REPO_ROOT, "node_modules/vitest/vitest.mjs");

function runVitest(cwd: string): void {
  execSync(`node ${JSON.stringify(VITEST_BIN)} run`, { cwd, stdio: "pipe" });
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "g17-"));
  const conn = new SqliteConnection({ path: join(dir, "d.sqlite") });
  runMigrations(conn, [...SCOPE_LINK_MIGRATIONS, ...WORKSPACE_MIGRATIONS, ...AUDIT_LOG_MIGRATIONS]);
  const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
  const workspaceStore = new WorkspaceStore({ conn });
  const auditStore = new AuditLogStore({ conn, scopeId: A });
  return {
    dir,
    conn,
    linkStore,
    workspaceStore,
    auditStore,
    planner: new DetachPlanner({ localScopeId: A, linkStore, workspaceStore, auditStore }),
    executor: new DetachExecutor({
      localScopeId: A,
      linkStore,
      workspaceStore,
      auditStore,
      rootDir: dir,
    }),
  };
}
async function tear(dir: string, conn: SqliteConnection) {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G17 extends GateRunner {
  readonly id = "G17";
  readonly title = "Detach Roundtrip";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G17.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G17.1", "detach unit tests pass", () => {
        runVitest(join(REPO_ROOT, "packages/detach"));
      }),
      await this.check("G17.2", "planUnlink + execute revokes both directions", async () => {
        const { dir, conn, linkStore, planner, executor } = await setup();
        try {
          linkStore.create({ remoteScopeId: B, direction: "outbound" });
          linkStore.updateStatus(B, "outbound", "active");
          linkStore.create({ remoteScopeId: B, direction: "inbound" });
          linkStore.updateStatus(B, "inbound", "active");
          const plan = planner.planUnlink(B);
          await executor.execute(plan, plan.confirmationToken);
          if (linkStore.get(B, "outbound").status !== "revoked")
            throw new Error("outbound not revoked");
          if (linkStore.get(B, "inbound").status !== "revoked")
            throw new Error("inbound not revoked");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G17.3", "invalid confirmation token rejected", async () => {
        const { dir, conn, linkStore, planner, executor } = await setup();
        try {
          linkStore.create({ remoteScopeId: B, direction: "outbound" });
          linkStore.updateStatus(B, "outbound", "active");
          const plan = planner.planUnlink(B);
          let caught = false;
          try {
            await executor.execute(plan, "detach:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ");
          } catch (e) {
            caught = e instanceof InvalidConfirmationError;
          }
          if (!caught) throw new Error("bad token accepted");
          if (linkStore.get(B, "outbound").status !== "active")
            throw new Error("link mutated despite bad token");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check(
        "G17.4",
        "dry run does not mutate links but writes audit entry",
        async () => {
          const { dir, conn, linkStore, auditStore, planner, executor } = await setup();
          try {
            linkStore.create({ remoteScopeId: B, direction: "outbound" });
            linkStore.updateStatus(B, "outbound", "active");
            const before = auditStore.count();
            const plan = planner.planUnlink(B);
            await executor.execute(plan, plan.confirmationToken, { dryRun: true });
            if (linkStore.get(B, "outbound").status !== "active")
              throw new Error("dry run mutated link");
            if (auditStore.count() !== before + 1)
              throw new Error("dry run did not record audit entry");
          } finally {
            await tear(dir, conn);
          }
        },
      ),
      await this.check(
        "G17.5",
        "detach event chained into audit log + verifyChain green",
        async () => {
          const { dir, conn, linkStore, auditStore, planner, executor } = await setup();
          try {
            linkStore.create({ remoteScopeId: B, direction: "outbound" });
            linkStore.updateStatus(B, "outbound", "active");
            auditStore.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
            auditStore.append({
              actorScopeId: A,
              eventKind: "link_created",
              payload: { remote: B },
            });
            const plan = planner.planUnlink(B);
            const report = await executor.execute(plan, plan.confirmationToken);
            if (!report.verifierChainHash) throw new Error("no verifier chain hash");
            if (auditStore.verifyChain().entriesChecked !== 3)
              throw new Error("audit chain wrong length");
          } finally {
            await tear(dir, conn);
          }
        },
      ),
      await this.check("G17.6", "tokens differ across plans (salt randomness)", async () => {
        const { dir, conn, linkStore, planner } = await setup();
        try {
          linkStore.create({ remoteScopeId: B, direction: "outbound" });
          linkStore.updateStatus(B, "outbound", "active");
          const p1 = planner.planUnlink(B);
          const p2 = planner.planUnlink(B);
          if (p1.confirmationToken === p2.confirmationToken) throw new Error("tokens collided");
        } finally {
          await tear(dir, conn);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G17-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G17();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G17 crashed:", e);
  process.exit(2);
});
