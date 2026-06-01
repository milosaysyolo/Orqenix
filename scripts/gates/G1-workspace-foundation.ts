#!/usr/bin/env tsx

import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(__dirname, "../..");
const GATE_SPEC = join(REPO_ROOT, ".orqenix/charter-gates/G1.yaml");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

interface GateSpec {
  id: string;
  title: string;
  bsRef: string;
  criteria: Array<{ id: string; description: string; command?: string }>;
}

class G1WorkspaceFoundation extends GateRunner {
  readonly id = "G1";
  readonly title = "Workspace Foundation";

  protected loadSpec(): GateSpec {
    if (!existsSync(GATE_SPEC)) {
      return {
        id: "G1",
        title: "Workspace Foundation",
        bsRef: "docs/sdd/BS-001-workspace-foundation.md",
        criteria: [
          { id: "G1.1", description: "pnpm-workspace.yaml resolves to >= 30 packages" },
          { id: "G1.2", description: "no circular dependencies" },
          { id: "G1.3", description: "topological build succeeds" },
          { id: "G1.4", description: "OSS / Pro boundary preserved" },
        ],
      };
    }
    return parseYaml(readFileSync(GATE_SPEC, "utf-8")) as GateSpec;
  }

  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G1.1", "Workspace resolves >= 30 packages", () => {
        const out = execSync("pnpm -r list --depth -1 --json", {
          cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024,
        });
        const arr = JSON.parse(out) as unknown[];
        if (arr.length < 30) throw new Error(`Expected >= 30 packages, got ${arr.length}`);
      }),
      await this.check("G1.2", "All packages have valid package.json", () => {
        execSync("pnpm -r exec node -e \"JSON.parse(require('fs').readFileSync('package.json'))\"", {
          cwd: REPO_ROOT, stdio: "pipe",
        });
      }),
      await this.check("G1.3", "Topological build succeeds", () => {
        execSync("pnpm build", { cwd: REPO_ROOT, stdio: "pipe" });
      }),
      await this.check("G1.4", "Phase 5 _meta package present", () => {
        if (!existsSync(join(REPO_ROOT, "packages/_meta/phase-5-readiness.ts"))) {
          throw new Error("_meta/phase-5-readiness.ts not found");
        }
      }),
    ];
  }

  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const path = join(REPORT_DIR, `G1-${ts}.json`);
    writeFileSync(path, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${path}\n`);
  }
}

async function main(): Promise<void> {
  const runner = new G1WorkspaceFoundation();
  const report = await runner.execute();
  runner.printSummary(report);
  process.exit(report.status === "pass" ? 0 : 1);
}

main().catch((err) => { console.error("Gate G1 crashed:", err); process.exit(2); });
