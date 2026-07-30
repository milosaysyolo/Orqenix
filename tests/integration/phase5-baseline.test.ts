import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(__dirname, "../..");
const WORKSPACE_FILE = join(REPO_ROOT, "pnpm-workspace.yaml");

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function getPackages(): PackageJson[] {
  const output = execSync("pnpm -r list --json --depth -1", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const parsed = JSON.parse(output) as Array<{ path: string; name: string; version: string }>;
  return parsed
    .filter((p) => p.path !== REPO_ROOT)
    .map((p) => JSON.parse(readFileSync(join(p.path, "package.json"), "utf-8")) as PackageJson);
}

function detectCycles(packages: PackageJson[]): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const pkg of packages) {
    const deps = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    graph.set(pkg.name, deps);
  }
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  function dfs(node: string): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      if (graph.has(next)) dfs(next);
    }
    path.pop();
    stack.delete(node);
  }
  for (const name of graph.keys()) dfs(name);
  return cycles;
}

describe("Phase 5 Baseline Integration (G1)", () => {
  let packages: PackageJson[];

  beforeAll(() => {
    packages = getPackages();
  }, 60_000);

  it("resolves workspace packages", () => {
    expect(packages.length).toBeGreaterThanOrEqual(20);
    const names = packages.map((p) => p.name).sort();
    const ossCount = names.filter((n) => n.startsWith("@orqenix/")).length;
    expect(ossCount).toBeGreaterThanOrEqual(10);
  });

  it("has no circular dependencies", () => {
    const cycles = detectCycles(packages);
    expect(cycles).toEqual([]);
  });

  it("compiles project references", () => {
    expect(() => {
      execSync("pnpm build", { cwd: REPO_ROOT, stdio: "pipe", encoding: "utf-8" });
    }).not.toThrow();
  }, 120_000);

  it("keeps Phase 4 plugin-compression contract", () => {
    const pluginPath = join(REPO_ROOT, "packages/plugin-compression");
    expect(existsSync(pluginPath)).toBe(true);
  });
});
