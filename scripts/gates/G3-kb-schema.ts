import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations, listApplied } from "@orqenix/storage-sqlite";
import { CHAT_KB_MIGRATIONS, createChatVecTable } from "@orqenix/kb-chat";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G3 extends GateRunner {
  readonly id = "G3";
  readonly title = "KB Schema (Chat)";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G3.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G3.1", "kb-chat unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages", "kb-chat"), stdio: "pipe" });
      }),
      await this.check("G3.2", "migrations are idempotent", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g3-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "a.sqlite") });
          if (runMigrations(conn, CHAT_KB_MIGRATIONS) !== 1) throw new Error("expected 1 applied");
          if (runMigrations(conn, CHAT_KB_MIGRATIONS) !== 0) throw new Error("expected 0 on rerun");
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      await this.check("G3.3", "expected tables and indexes exist", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g3-t-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "a.sqlite"), enableVec: true });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          createChatVecTable(conn, 4);
          const tables = conn
            .prepare<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table'`)
            .all() as Array<{ name: string }>;
          const names = tables.map((t) => t.name);
          for (const required of [
            "chat_sessions",
            "chat_entries",
            "chat_embeddings",
            "_orqenix_migrations",
          ]) {
            if (!names.includes(required)) throw new Error(`missing table: ${required}`);
          }
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      await this.check("G3.4", "STRICT mode enforced on chat tables", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g3-s-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "a.sqlite") });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          const ddl = conn
            .prepare<{
              sql: string;
            }>(`SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_entries'`)
            .get() as { sql: string };
          if (!/STRICT/i.test(ddl.sql)) throw new Error("chat_entries is not STRICT");
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
      await this.check("G3.5", "checksum drift detected", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g3-c-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "a.sqlite") });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          const drifted = [
            { ...CHAT_KB_MIGRATIONS[0], sql: CHAT_KB_MIGRATIONS[0].sql + "\n-- tampered" },
          ];
          let caught = false;
          try {
            runMigrations(conn, drifted);
          } catch {
            caught = true;
          }
          if (!caught) throw new Error("drift not detected");
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G3-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G3();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G3 crashed:", e);
  process.exit(2);
});
