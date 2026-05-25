import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface Check {
  name: string;
  run: () => Promise<{ pass: boolean; msg?: string }>;
}

const ROOT = process.cwd();
const SHELL = process.platform === "win32";
const IS_CI = process.env.CI === "true";

const NEW_PACKAGES = [
  "memory-tiers",
  "plugin-compress-input",
  "plugin-compress-output",
  "plugin-compress-context",
  "plugin-picker",
  "plugin-lazy-loader",
];

const checks: Check[] = [
  {
    name: "phase 2 verification still passes",
    run: async () => {
      const r = spawnSync("pnpm", ["verify-phase-2"], { stdio: "inherit", shell: SHELL });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "core: sweepExpired method present",
    run: async () => {
      const fs = await import("node:fs/promises");
      const code = await fs.readFile(
        join(ROOT, "packages/core/src/storage/sqlite-adapter.ts"),
        "utf-8",
      );
      return {
        pass: code.includes("sweepExpired") && code.includes("vacuum"),
        msg: "sqlite-adapter missing sweepExpired or vacuum",
      };
    },
  },
  ...NEW_PACKAGES.map<Check>((name) => ({
    name: `package exists: @orqenix/${name}`,
    run: async () => ({
      pass: existsSync(join(ROOT, `packages/${name}/package.json`)),
      msg: `packages/${name}/package.json missing`,
    }),
  })),
  {
    name: "cli: memory command registered",
    run: async () => {
      const fs = await import("node:fs/promises");
      const idx = await fs.readFile(join(ROOT, "packages/cli/src/index.ts"), "utf-8");
      const cmd = await fs.readFile(join(ROOT, "packages/cli/src/commands/memory.ts"), "utf-8");
      return {
        pass: idx.includes("memoryCmd") && cmd.includes("preview-cleanup"),
        msg: "memory command not wired",
      };
    },
  },
  {
    name: "docs: 3 architecture notes present",
    run: async () => {
      const required = ["compression-system.md", "memory-tiers.md", "picker-and-lazy-load.md"];
      const missing = required.filter((f) => !existsSync(join(ROOT, "docs/architecture", f)));
      return {
        pass: missing.length === 0,
        msg: missing.length ? `missing: ${missing.join(", ")}` : undefined,
      };
    },
  },
  {
    name: "monetization compliance: 0 paid packages",
    run: async () => {
      const fs = await import("node:fs/promises");
      const pkgs = await fs.readdir(join(ROOT, "packages"), { withFileTypes: true });
      const paid = pkgs.filter(
        (e) =>
          e.isDirectory() &&
          (e.name.startsWith("orqenix-pro") || e.name.startsWith("orqenix-cloud")),
      );
      return {
        pass: paid.length === 0,
        msg: paid.length ? `phase 3 must ship 0 paid packages, found ${paid.length}` : undefined,
      };
    },
  },
  {
    name: "build succeeds",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "build"], { stdio: "inherit", shell: SHELL });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "tests pass",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "test"], { stdio: "inherit", shell: SHELL });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "typecheck passes",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "typecheck"], { stdio: "inherit", shell: SHELL });
      return { pass: r.status === 0 };
    },
  },
];

(async () => {
  let failures = 0;
  for (const c of checks) {
    process.stdout.write(`  \u2022 ${c.name} ... `);
    const r = await c.run();
    if (r.pass) {
      process.stdout.write("\u2713\n");
    } else {
      process.stdout.write(`\u2717  (${r.msg ?? "fail"})\n`);
      failures++;
    }
  }
  if (failures === 0) {
    console.log(`\n\u2713 All checks passed${IS_CI ? " (CI)" : ""}`);
    process.exit(0);
  } else {
    console.error(`\n\u2717 ${failures} check(s) failed`);
    process.exit(1);
  }
})();
