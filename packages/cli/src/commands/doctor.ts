import { defineCommand } from "citty";
import consola from "consola";
import kleur from "kleur";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { detectGitInfo, detectSession, generateScopeId } from "@orqenix/core/scope";
import { loadConfig } from "@orqenix/core/config";
import { SyncEngine } from "@orqenix/core/sync";
import {
  orqenixGlobalConfigDir,
  orqenixDataDir,
} from "@orqenix/core";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
}

async function checkNode(): Promise<CheckResult> {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) return { name: `node ${process.versions.node}`, status: "ok" };
  return {
    name: `node ${process.versions.node}`,
    status: "fail",
    detail: "Orqenix requires Node 20 LTS or later",
  };
}

async function checkPnpm(): Promise<CheckResult> {
  const r = spawnSync("pnpm", ["--version"], { encoding: "utf-8" });
  if (r.status !== 0) {
    return { name: "pnpm", status: "warn", detail: "pnpm not found in PATH" };
  }
  const v = (r.stdout ?? "").trim();
  const major = Number(v.split(".")[0]);
  if (major >= 9) return { name: `pnpm ${v}`, status: "ok" };
  return { name: `pnpm ${v}`, status: "warn", detail: "pnpm 9+ recommended" };
}

async function checkGit(): Promise<CheckResult> {
  const r = spawnSync("git", ["--version"], { encoding: "utf-8" });
  if (r.status !== 0) {
    return { name: "git", status: "warn", detail: "system git not found (isomorphic-git fallback ok)" };
  }
  return { name: (r.stdout ?? "git").trim(), status: "ok" };
}

async function checkWritable(path: string, label: string): Promise<CheckResult> {
  try {
    await mkdir(path, { recursive: true });
    const probe = join(path, `.probe-${Date.now()}`);
    await writeFile(probe, "probe", "utf-8");
    await unlink(probe);
    return { name: `writable: ${label}`, status: "ok", detail: path };
  } catch (err) {
    return {
      name: `writable: ${label}`,
      status: "fail",
      detail: `${path} — ${String(err)}`,
    };
  }
}

async function checkPort(port: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve({
        name: `port ${port}`,
        status: "warn",
        detail: "in use (Web UI will need a different port)",
      });
    });
    server.once("listening", () => {
      server.close(() => resolve({ name: `port ${port}`, status: "ok" }));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function checkGitRepo(): Promise<CheckResult & { info?: any }> {
  const info = await detectGitInfo();
  if (!info) return { name: "git repo", status: "warn", detail: "not inside a git repo" };
  return {
    name: "git repo",
    status: "ok",
    detail: `${info.repoRoot} (${info.branch})`,
    info,
  };
}

async function checkScope(): Promise<CheckResult> {
  const info = await detectGitInfo();
  if (!info) return { name: "scope", status: "warn", detail: "no git repo" };
  const session = await detectSession();
  const scope = generateScopeId({
    project: info.repoRoot,
    branch: info.branch,
    worktree: info.worktreePath,
    session,
  });
  return { name: "scope", status: "ok", detail: `${scope.short} (${scope.full})` };
}

async function checkSyncDrift(cwd: string): Promise<CheckResult> {
  const orqenixDir = join(cwd, ".orqenix");
  if (!existsSync(orqenixDir)) {
    return { name: "sync", status: "warn", detail: "no .orqenix in cwd (run orqenix init)" };
  }
  try {
    const cfg = await loadConfig(cwd);
    const engine = new SyncEngine(cwd, cfg);
    const results = await engine.syncAll({ verify: true });
    const drift = results.flatMap((r) => r.drift);
    if (drift.length === 0) return { name: "sync", status: "ok", detail: "no drift" };
    return {
      name: "sync",
      status: "warn",
      detail: `${drift.length} file(s) drifted: ${drift.slice(0, 3).join(", ")}${drift.length > 3 ? "..." : ""}`,
    };
  } catch (err) {
    return { name: "sync", status: "fail", detail: String(err) };
  }
}

export const doctor = defineCommand({
  meta: { name: "doctor", description: "Diagnose your Orqenix installation" },
  args: {
    cwd: { type: "string", default: process.cwd() },
    noPortCheck: { type: "boolean", default: false, alias: "no-port-check" },
  },
  async run({ args }) {
    consola.start("Running Orqenix doctor");

    const results: CheckResult[] = [];
    results.push(await checkNode());
    results.push(await checkPnpm());
    results.push(await checkGit());
    results.push(await checkWritable(orqenixGlobalConfigDir(), "~/.config/orqenix"));
    results.push(await checkWritable(orqenixDataDir(), "~/.local/share/orqenix"));
    if (!args.noPortCheck) results.push(await checkPort(39397));
    results.push(await checkGitRepo());
    results.push(await checkScope());
    results.push(await checkSyncDrift(args.cwd));

    let ok = 0, warn = 0, fail = 0;
    for (const r of results) {
      const icon =
        r.status === "ok" ? kleur.green("✓") : r.status === "warn" ? kleur.yellow("⚠") : kleur.red("✗");
      consola.log(`  ${icon} ${r.name}${r.detail ? kleur.gray(`  (${r.detail})`) : ""}`);
      if (r.status === "ok") ok++;
      else if (r.status === "warn") warn++;
      else fail++;
    }

    consola.log("");
    if (fail > 0) {
      consola.error(`${ok} ok, ${warn} warning(s), ${fail} failure(s)`);
      process.exit(1);
    } else if (warn > 0) {
      consola.warn(`${ok} ok, ${warn} warning(s)`);
    } else {
      consola.success(`${ok} checks passed`);
    }
  },
});
