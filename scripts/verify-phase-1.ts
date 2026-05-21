import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface Check {
  name: string;
  run: () => Promise<{ pass: boolean; msg?: string }>;
}

const ROOT = process.cwd();
const checks: Check[] = [
  { name: "monorepo: pnpm workspace exists", run: async () => ({ pass: existsSync(join(ROOT, "pnpm-workspace.yaml")) }) },
  { name: "monorepo: turbo config exists", run: async () => ({ pass: existsSync(join(ROOT, "turbo.json")) }) },
  { name: "packages/core exists", run: async () => ({ pass: existsSync(join(ROOT, "packages/core/package.json")) }) },
  { name: "packages/cli exists", run: async () => ({ pass: existsSync(join(ROOT, "packages/cli/package.json")) }) },
  {
    name: "dev-team has 6 agents",
    run: async () => {
      const dir = join(ROOT, "packages/teams-built-in/dev-team/agents");
      const expected = ["lead.md", "builder.md", "inspector.md", "navigator.md", "debugger.md", "researcher.md"];
      const missing = expected.filter((f) => !existsSync(join(dir, f)));
      return { pass: missing.length === 0, msg: missing.length ? `missing: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "core implements all phase-1 stubs",
    run: async () => {
      const fs = await import("node:fs/promises");
      const skill = await fs.readFile(join(ROOT, "packages/core/src/sync/skill-compiler.ts"), "utf-8");
      const engine = await fs.readFile(join(ROOT, "packages/core/src/sync/engine.ts"), "utf-8");
      const watcher = existsSync(join(ROOT, "packages/core/src/sync/watcher.ts"));
      const okSkill = skill.includes("compileSkillForOpenCode") && !skill.includes("stub: compileSkillForOpenCode");
      const okEngine = engine.includes("conflictPrompt") && engine.includes("verify");
      return {
        pass: okSkill && okEngine && watcher,
        msg: !okSkill ? "skill-compiler stub remains" : !okEngine ? "engine missing prompt/verify" : !watcher ? "watcher missing" : undefined,
      };
    },
  },
  {
    name: "build succeeds",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "build"], { stdio: "inherit", shell: true });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "tests pass",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "test"], { stdio: "inherit", shell: true });
      return { pass: r.status === 0 };
    },
  },
  {
    name: "typecheck passes",
    run: async () => {
      const r = spawnSync("pnpm", ["-w", "typecheck"], { stdio: "inherit", shell: true });
      return { pass: r.status === 0 };
    },
  },
];

(async () => {
  let failures = 0;
  for (const c of checks) {
    process.stdout.write(`  • ${c.name} ... `);
    const r = await c.run();
    if (r.pass) {
      process.stdout.write("✓\n");
    } else {
      process.stdout.write(`✗  (${r.msg ?? "fail"})\n`);
      failures++;
    }
  }

  if (failures === 0) {
    console.log("\n✓ All checks passed");
    process.exit(0);
  } else {
    console.error(`\n✗ ${failures} check(s) failed`);
    process.exit(1);
  }
})();
