#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import consola from "consola";

interface PackageScaffold {
  name: string;
  dir: string;
  files: Record<string, string>;
}

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function scaffoldPackage(pkg: PackageScaffold): Promise<void> {
  const fullDir = join(process.cwd(), pkg.dir);
  await ensureDir(fullDir);
  await ensureDir(join(fullDir, "src"));

  for (const [filePath, content] of Object.entries(pkg.files)) {
    const fullPath = join(fullDir, filePath);
    if (existsSync(fullPath)) {
      consola.info(`  Skipping existing: ${filePath}`);
      continue;
    }
    await writeFile(fullPath, content);
    consola.info(`  Created: ${filePath}`);
  }
}

const packages: PackageScaffold[] = [];

consola.start("Scaffold: creating new Orqenix packages\n");

// @orqenix/gate-runner-core
packages.push({
  name: "@orqenix/gate-runner-core",
  dir: "packages/gate-runner-core",
  files: {
    "package.json": JSON.stringify({
      name: "@orqenix/gate-runner-core",
      version: "0.5.0-phase-5",
      description: "Shared base for Orqenix charter gate runners",
      license: "Apache-2.0",
      type: "module",
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
      scripts: { build: "tsc --build", test: "vitest run" },
      devDependencies: { typescript: "^5.6.0", vitest: "^2.1.0" },
    }, null, 2),
    "src/index.ts": `export interface GateCheck {
  id: string;
  description: string;
  status: "pass" | "fail";
  durationMs: number;
}
export type GateCheckResult = GateCheck;
export interface GateReport {
  gateId: string;
  title: string;
  status: "pass" | "fail" | "partial";
  checks: GateCheck[];
  summary: { total: number; passed: number; failed: number };
}
export abstract class GateRunner {
  abstract readonly id: string;
  abstract readonly title: string;
  protected abstract loadSpec(): unknown;
  protected abstract runChecks(): Promise<GateCheck[]>;
  protected abstract writeReport(report: GateReport): void;
  async execute(): Promise<GateReport> {
    this.loadSpec();
    const checks = await this.runChecks();
    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.length - passed;
    const status: GateReport["status"] = failed === 0 ? "pass" : passed === 0 ? "fail" : "partial";
    const report: GateReport = { gateId: this.id, title: this.title, status, checks, summary: { total: checks.length, passed, failed } };
    this.writeReport(report);
    return report;
  }
  printSummary(report: GateReport): void {
    for (const c of report.checks) {
      console.log(\`\${c.status === "pass" ? "✓" : "✗"} \${c.id} \${c.description}\`);
    }
  }
}`,
  },
});

for (const pkg of packages) {
  consola.info(`Scaffolding ${pkg.name}...`);
  await scaffoldPackage(pkg);
}

consola.success(`\nDone. ${packages.length} packages scaffolded.`);
