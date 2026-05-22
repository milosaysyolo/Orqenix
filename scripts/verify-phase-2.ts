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
  "plugin-host",
  "mcp-client",
  "mcp-server",
  "opencode-plugin",
  "skill-kit",
  "plugin-cost-tracker",
  "plugin-semantic-cache",
  "plugin-knowledge-workflow",
];

const checks: Check[] = [
  {
    name: "phase 1 verification still passes",
    run: async () => {
      const r = spawnSync("pnpm", ["verify-phase-1"], { stdio: "inherit", shell: SHELL });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "core: plugin module exists",
    run: async () => {
      const p = join(ROOT, "packages/core/src/plugin/registry.ts");
      return { pass: existsSync(p), msg: existsSync(p) ? undefined : `missing ${p}` };
    },
  },
  {
    name: "core: plugin subpath in exports",
    run: async () => {
      const fs = await import("node:fs/promises");
      const pkg = JSON.parse(await fs.readFile(join(ROOT, "packages/core/package.json"), "utf-8"));
      const ok = pkg.exports?.["./plugin"]?.types?.includes("plugin");
      return {
        pass: !!ok,
        msg: ok ? undefined : "packages/core/package.json missing ./plugin export",
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
    name: "cli: plugin command registered",
    run: async () => {
      const fs = await import("node:fs/promises");
      const idx = await fs.readFile(join(ROOT, "packages/cli/src/index.ts"), "utf-8");
      const cmd = await fs.readFile(join(ROOT, "packages/cli/src/commands/plugin.ts"), "utf-8");
      return {
        pass: idx.includes("pluginCmd") && cmd.includes('name: "list"'),
        msg: "plugin command not wired",
      };
    },
  },
  {
    name: "cli: mcp command registered",
    run: async () => {
      const fs = await import("node:fs/promises");
      const idx = await fs.readFile(join(ROOT, "packages/cli/src/index.ts"), "utf-8");
      const cmd = await fs.readFile(join(ROOT, "packages/cli/src/commands/mcp.ts"), "utf-8");
      return {
        pass: idx.includes("mcpCmd") && cmd.includes("serve"),
        msg: "mcp command not wired",
      };
    },
  },
  {
    name: "cli: opencode-plugin registered in init",
    run: async () => {
      const fs = await import("node:fs/promises");
      const init = await fs.readFile(join(ROOT, "packages/cli/src/commands/init.ts"), "utf-8");
      return {
        pass: init.includes("@orqenix/opencode-plugin"),
        msg: "init does not register opencode-plugin",
      };
    },
  },
  {
    name: "docs: phase-2 implementation guide exists",
    run: async () => ({
      pass: existsSync(join(ROOT, "docs/implementation/phase-2-capability.md")),
    }),
  },
  {
    name: "docs: 3 architecture notes present",
    run: async () => {
      const required = ["plugin-system.md", "mcp-integration.md", "skill-loader.md"];
      const missing = required.filter(
        (f) => !existsSync(join(ROOT, "docs/architecture", f)),
      );
      return {
        pass: missing.length === 0,
        msg: missing.length ? `missing: ${missing.join(", ")}` : undefined,
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
