#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import consola from "consola";

const [, , ...args] = process.argv;

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

function parseArgs(): { name: string; dir: string; license: string; todo: string } {
  const defaults = { name: "", dir: "", license: "Apache-2.0", todo: "Part-X" };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--name":
        defaults.name = args[++i];
        break;
      case "--path":
        defaults.dir = args[++i];
        break;
      case "--license":
        defaults.license = args[++i];
        break;
      case "--todo":
        defaults.todo = args[++i];
        break;
    }
  }
  return defaults;
}

function capitalize(s: string): string {
  return s
    .replace(/[-_](.)/g, (_, c) => " " + c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

const packages: PackageScaffold[] = [];

if (args.includes("--name") && args.includes("--path")) {
  // CLI mode: scaffold a single package from args
  const opts = parseArgs();
  const shortName = opts.name.replace(/^@orqenix[-/]?/, "").replace(/-/g, " ");
  const desc = capitalize(shortName);
  const isPro = opts.name.startsWith("@orqenix-pro/");
  const dirName = opts.dir;
  const srcName = opts.name;
  const inject = isPro ? "" : `import { defineConfig } from "vitest/config";`;

  packages.push({
    name: srcName,
    dir: dirName,
    files: {
      "package.json": JSON.stringify(
        {
          name: srcName,
          version: "0.5.0-phase-5",
          description: `${desc} for Orqenix (${opts.todo})`,
          license: opts.license,
          type: "module",
          main: "./dist/index.js",
          types: "./dist/index.d.ts",
          exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
          scripts: { build: "tsc --build", test: "vitest run" },
          devDependencies: { typescript: "^5.6.0", vitest: "^2.1.0" },
        },
        null,
        2,
      ),
      "tsconfig.json": JSON.stringify(
        {
          extends: isPro ? "../../../tsconfig.base.json" : "../../tsconfig.base.json",
          compilerOptions: { composite: true, outDir: "./dist", rootDir: "./src" },
          include: ["src/**/*"],
          exclude: ["dist", "node_modules", "**/*.test.ts"],
        },
        null,
        2,
      ),
      "src/index.ts": `// SPDX-License-Identifier: ${opts.license}
// Scaffold for ${opts.todo}
// TODO_${opts.todo.replace(/-/g, "_")}: implement ${desc} logic

export const PACKAGE_VERSION = '0.5.0-phase-5';
export const TODO = '${opts.todo.replace(/-/g, "_")}' as const;

console.info('${srcName}: scaffold loaded, TODO: ' + TODO);
`,
      "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: false,
    environment: "node",
  },
});
`,
      "README.md": `# ${srcName}
\n${desc} for Orqenix (${opts.todo}).\n\n## Status\n\nScaffold only. Implement in ${opts.todo}.\n`,
    },
  });
} else {
  // Legacy mode: hardcoded packages
  consola.start("Scaffold: creating new Orqenix packages\n");

  packages.push({
    name: "@orqenix/gate-runner-core",
    dir: "packages/gate-runner-core",
    files: {
      "package.json": JSON.stringify(
        {
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
        },
        null,
        2,
      ),
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
  async check(id: string, description: string, fn: () => void | Promise<void>): Promise<GateCheck> {
    const start = Date.now();
    try {
      await fn();
      return { id, description, status: "pass", durationMs: Date.now() - start };
    } catch (e) {
      console.error(\`[GATE] \${id} FAILED: \${(e as Error).message}\`);
      return { id, description, status: "fail", durationMs: Date.now() - start };
    }
  }
}`,
    },
  });
}

async function main(): Promise<void> {
  for (const pkg of packages) {
    consola.info(`Scaffolding ${pkg.name}...`);
    await scaffoldPackage(pkg);
  }
  consola.success(`\nDone. ${packages.length} packages scaffolded.`);
}

main().catch((e) => {
  consola.error(e);
  process.exit(1);
});
