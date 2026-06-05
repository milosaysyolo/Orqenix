// SPDX-License-Identifier: Apache-2.0
// @gate G25
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs, dispatch, usage } from "@orqenix/cli";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

async function fresh() {
  const dir = await mkdtemp(join(tmpdir(), "g25-"));
  const ctx = {
    rootDir: dir,
    dbPath: join(dir, "kb.sqlite"),
    scopeId: SCOPE,
    io: { stdout: () => {}, stderr: () => {} },
  };
  return { dir, ctx };
}
async function tear(dir: string) {
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G25 extends GateRunner {
  readonly id = "G25";
  readonly title = "CLI Surface";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G25.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G25.1", "cli unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/cli"), stdio: "pipe" });
      }),
      await this.check("G25.2", "usage lists all command groups", () => {
        const u = usage();
        for (const cmd of ["scope", "link", "workspace", "audit", "detach", "migrate", "version"]) {
          if (!u.includes(cmd)) throw new Error(`usage missing command: ${cmd}`);
        }
      }),
      await this.check("G25.3", "version command returns Phase 5 version", async () => {
        const { dir, ctx } = await fresh();
        try {
          const r = await dispatch(ctx, parseArgs(["version"]));
          if (r.exitCode !== 0) throw new Error("non-zero exit");
          if (!r.output?.includes("0.5.0-phase-5")) throw new Error("version mismatch");
        } finally {
          await tear(dir);
        }
      }),
      await this.check("G25.4", "unknown command returns exit 1 with usage hint", async () => {
        const { dir, ctx } = await fresh();
        try {
          const r = await dispatch(ctx, parseArgs(["banana"]));
          if (r.exitCode !== 1) throw new Error("expected exit 1");
          if (!r.output?.includes("unknown command")) throw new Error("no error message");
        } finally {
          await tear(dir);
        }
      }),
      await this.check("G25.5", "link create + link list round-trip", async () => {
        const { dir, ctx } = await fresh();
        try {
          const c = await dispatch(ctx, parseArgs(["link", "create", "--remote", B]));
          if (c.exitCode !== 0) throw new Error("create failed");
          const l = await dispatch(ctx, parseArgs(["link", "list"]));
          if (!l.output?.includes(B)) throw new Error("list missing created link");
        } finally {
          await tear(dir);
        }
      }),
      await this.check("G25.6", "workspace create + workspace list round-trip", async () => {
        const { dir, ctx } = await fresh();
        try {
          const c = await dispatch(ctx, parseArgs(["workspace", "create", "--name", "demo"]));
          if (c.exitCode !== 0) throw new Error("create failed");
          const l = await dispatch(ctx, parseArgs(["workspace", "list"]));
          if (!l.output?.includes("demo")) throw new Error("list missing workspace");
        } finally {
          await tear(dir);
        }
      }),
      await this.check("G25.7", "audit verify works on empty log", async () => {
        const { dir, ctx } = await fresh();
        try {
          const r = await dispatch(ctx, parseArgs(["audit", "verify"]));
          if (r.exitCode !== 0) throw new Error("verify failed");
          if (!r.output?.includes('"ok": true')) throw new Error("not ok");
        } finally {
          await tear(dir);
        }
      }),
      await this.check(
        "G25.8",
        "required flag enforcement (scope init without --name)",
        async () => {
          const { dir, ctx } = await fresh();
          try {
            const r = await dispatch(ctx, parseArgs(["scope", "init"]));
            if (r.exitCode !== 1) throw new Error("missing flag was not enforced");
          } finally {
            await tear(dir);
          }
        },
      ),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G25-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G25();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G25 crashed:", e);
  process.exit(2);
});
