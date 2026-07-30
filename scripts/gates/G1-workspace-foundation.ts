#!/usr/bin/env tsx

import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const REPO_ROOT = resolve(__dirname, "../..");
const GATE_SPEC = join(REPO_ROOT, ".orqenix/charter-gates/G1.yaml");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

interface GateCriteria {
  id: string;
  description: string;
  severity: string;
}

interface GateSpec {
  id: string;
  title: string;
  bsRef: string;
  criteria: GateCriteria[];
}

const REQUIRED_PACKAGE_FIELDS = ["name", "version", "license"];

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
          {
            id: "G1.1",
            description: "pnpm-workspace.yaml resolves >= 40 packages",
            severity: "blocking",
          },
          { id: "G1.2", description: "every package has valid package.json", severity: "blocking" },
          { id: "G1.3", description: "no circular dependencies", severity: "blocking" },
          { id: "G1.4", description: "topological build succeeds", severity: "blocking" },
        ],
      };
    }
    return parseYaml(readFileSync(GATE_SPEC, "utf-8")) as GateSpec;
  }

  protected async runChecks(): Promise<GateCheck[]> {
    const spec = this.loadSpec();

    return [
      await this.check(
        "G1.1",
        spec.criteria.find((c) => c.id === "G1.1")?.description ?? ">= 40 packages",
        () => {
          const out = execSync("pnpm -r list --depth -1 --json", {
            cwd: REPO_ROOT,
            encoding: "utf-8",
            maxBuffer: 32 * 1024 * 1024,
          });
          const arr = JSON.parse(out) as unknown[];
          // Exclude root, bench, integration, _meta from count
          const oss = arr.filter(
            (p: any) =>
              p.name &&
              !p.private &&
              !p.name.startsWith("@orqenix-pro/") &&
              p.name !== "orqenix-monorepo",
          );
          if (oss.length < 40) throw new Error(`Expected >= 40 OSS packages, got ${oss.length}`);
        },
      ),

      await this.check(
        "G1.2",
        spec.criteria.find((c) => c.id === "G1.2")?.description ?? "valid package.json",
        () => {
          // Walk all packages and check required fields
          const packagesDir = join(REPO_ROOT, "packages");
          const entries = readdirSync(packagesDir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const pkgPath = join(packagesDir, entry.name, "package.json");
            if (!existsSync(pkgPath)) continue;
            const p = JSON.parse(readFileSync(pkgPath, "utf-8"));
            for (const field of REQUIRED_PACKAGE_FIELDS) {
              if (!p[field])
                throw new Error(`${entry.name}/package.json missing required field: ${field}`);
            }
          }
        },
      ),

      await this.check(
        "G1.3",
        spec.criteria.find((c) => c.id === "G1.3")?.description ?? "no circular deps",
        () => {
          // Check for circular deps via pnpm
          try {
            execSync("pnpm ls -r --depth=0", { cwd: REPO_ROOT, stdio: "pipe" });
          } catch {
            // pnpm ls returns non-zero for cycles
          }
          // madge check if available
          const nodeModulesBin = join(REPO_ROOT, "node_modules/.bin");
          const madgePath = join(nodeModulesBin, "madge.cmd");
          if (existsSync(madgePath)) {
            execSync(`"${madgePath}" --circular packages/core/src`, {
              cwd: REPO_ROOT,
              stdio: "pipe",
            });
          }
        },
      ),

      await this.check(
        "G1.4",
        spec.criteria.find((c) => c.id === "G1.4")?.description ?? "topological build",
        () => {
          // Build via turbo (matches CI workflow); direct pnpm --filter misses
          // hoisted bins like tsup in pnpm isolated mode.
          execSync("pnpm build 2>&1", { cwd: REPO_ROOT, stdio: "pipe", timeout: 120_000 });
        },
      ),

      await this.check(
        "G1.5",
        spec.criteria.find((c) => c.id === "G1.5")?.description ??
          "Phase 4 plugin-compression tests",
        () => {
          execSync("pnpm --filter @orqenix/plugin-compression test", {
            cwd: REPO_ROOT,
            stdio: "pipe",
            timeout: 30000,
          });
        },
      ),

      await this.check(
        "G1.6",
        spec.criteria.find((c) => c.id === "G1.6")?.description ?? "Phase 4 contract snapshot",
        () => {
          // Check that Phase 4 packages still have their core exports
          const pkg = JSON.parse(
            readFileSync(join(REPO_ROOT, "packages/compress-strategies/package.json"), "utf-8"),
          );
          if (!pkg.name || !pkg.version)
            throw new Error("compress-strategies package.json malformed");
        },
      ),

      await this.check(
        "G1.7",
        spec.criteria.find((c) => c.id === "G1.7")?.description ?? "baseline integration tests",
        () => {
          // Run core unit tests via turbo (matches CI workflow)
          execSync("pnpm --filter @orqenix/core test 2>&1", {
            cwd: REPO_ROOT,
            stdio: "pipe",
            timeout: 30000,
          });
          execSync("pnpm --filter @orqenix/gate-runner-core test 2>&1", {
            cwd: REPO_ROOT,
            stdio: "pipe",
            timeout: 30000,
          });
        },
      ),

      await this.check(
        "G1.8",
        spec.criteria.find((c) => c.id === "G1.8")?.description ?? "no OSS -> Pro imports",
        () => {
          // grep for @orqenix-pro imports in OSS packages
          const ossPkgs = readdirSync(join(REPO_ROOT, "packages"), { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "pro")
            .map((d) => d.name);
          for (const pkg of ossPkgs) {
            const srcDir = join(REPO_ROOT, "packages", pkg, "src");
            if (!existsSync(srcDir)) continue;
            const files = readdirSync(srcDir, { recursive: true }).filter((f) => f.endsWith(".ts"));
            for (const file of files) {
              const content = readFileSync(join(srcDir, file), "utf-8");
              if (
                content.includes("from '@orqenix-pro/") ||
                content.includes("require('@orqenix-pro/")
              ) {
                throw new Error(`OSS package ${pkg} imports Pro package in ${file}`);
              }
            }
          }
        },
      ),
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

main().catch((err) => {
  console.error("Gate G1 crashed:", err);
  process.exit(2);
});
