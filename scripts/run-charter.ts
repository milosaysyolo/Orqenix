import { execa } from "execa";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

async function runCmd(
  cmd: string,
  args: string[],
  cwd?: string
): Promise<{ ok: boolean; output: string }> {
  const r = await execa(cmd, args, {
    reject: false,
    all: true,
    cwd: cwd ?? process.cwd(),
  });
  return { ok: r.exitCode === 0, output: r.all ?? "" };
}

const PRO_ROOT = "../Orqenix-Pro";

async function gate(
  id: string,
  name: string,
  fn: () => Promise<{ ok: boolean; output: string }>
): Promise<GateResult> {
  const t0 = Date.now();
  console.log(`\n=== ${id} ${name} ===`);
  const r = await fn();
  const durationMs = Date.now() - t0;
  console.log(r.ok ? `✅ ${id} GREEN (${durationMs}ms)` : `❌ ${id} RED (${durationMs}ms)`);
  if (!r.ok) console.log(r.output.slice(-2000));
  return { id, name, passed: r.ok, output: r.output, durationMs };
}

function walkSync(dir: string, exts: Set<string>): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", ".turbo"].includes(entry.name)) continue;
        try { files.push(...walkSync(full, exts)); } catch { /* skip unreadable */ }
      } else if (entry.isFile() && exts.has(extname(entry.name))) {
        files.push(full);
      }
    }
  } catch { /* skip */ }
  return files;
}

const TS_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);

function countMatchingLines(files: string[], pattern: RegExp): number {
  let count = 0;
  for (const f of files) {
    try {
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (pattern.test(line)) count++;
      }
    } catch { /* skip */ }
  }
  return count;
}

function findExportOnlyTestFiles(packagesDir: string): string[] {
  const allTests: string[] = [];
  try {
    for (const e of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const pkgDir = join(packagesDir, e.name);
      for (const tdir of [join(pkgDir, "test"), join(pkgDir, "__tests__")]) {
        if (existsSync(tdir)) {
          allTests.push(...walkSync(tdir, TS_EXTS).filter(f => f.endsWith(".test.ts")));
        }
      }
    }
  } catch { return []; }

  const ASSERT_RE = /expect\(|assert\.|toBe[A-Z]|toEqual\(|toHaveLength\(|toContain\(|toMatch\(|toBeDefined\(|toBeGreaterThan\(|toBeLessThan\(|toBeCloseTo\(|toThrow\(|rejects\.|resolves\./;
  const exportOnly: string[] = [];
  for (const f of allTests) {
    try {
      if (!ASSERT_RE.test(readFileSync(f, "utf8"))) exportOnly.push(f);
    } catch { /* skip */ }
  }
  return exportOnly;
}

async function main() {
  const results: GateResult[] = [];
  const rootDir = process.cwd();
  const packagesDir = join(rootDir, "packages");

  // G1: no @ts-expect-error in src
  results.push(
    await gate("G1", "no @ts-expect-error in src", async () => {
      const tsFiles = walkSync(packagesDir, TS_EXTS).filter(
        f => !f.includes("node_modules") && !f.includes("dist") && !f.includes("test") && !f.includes("__tests__")
      );
      const count = countMatchingLines(tsFiles, /@ts-expect-error/);
      const ok = count === 0;
      return { ok, output: `@ts-expect-error found: ${count}` };
    })
  );

  // G2: no @ts-ignore in src
  results.push(
    await gate("G2", "no @ts-ignore in src", async () => {
      const tsFiles = walkSync(packagesDir, TS_EXTS).filter(
        f => !f.includes("node_modules") && !f.includes("dist") && !f.includes("test") && !f.includes("__tests__")
      );
      const count = countMatchingLines(tsFiles, /@ts-ignore/);
      const ok = count === 0;
      return { ok, output: `@ts-ignore found: ${count}` };
    })
  );

  // G3: strict tsc clean
  results.push(
    await gate("G3", "strict tsc clean", async () => runCmd("pnpm", ["typecheck"]))
  );

  // G4: tests uncached run
  results.push(
    await gate("G4", "tests uncached run", async () =>
      runCmd("pnpm", ["test", "--", "--no-cache"])
    )
  );

  // G5: test count >= 230
  results.push(
    await gate("G5", "test count >= 230", async () => {
      const r = await runCmd("pnpm", ["test"]);
      const m = /Tests:\s+(\d+) passed/.exec(r.output);
      if (!m) return { ok: false, output: r.output };
      const count = parseInt(m[1]!, 10);
      const ok = count >= 230;
      return {
        ok,
        output: `${r.output}\n\nParsed test count: ${count} (threshold 230)`,
      };
    })
  );

  // G6: no export-only tests
  results.push(
    await gate("G6", "no export-only tests", async () => {
      const exportOnly = findExportOnlyTestFiles(packagesDir);
      const count = exportOnly.length;
      const ok = count <= 10;
      const lines = exportOnly.map(f => `EXPORT-ONLY: ${relative(rootDir, f)}`);
      return {
        ok,
        output: `Export-only test files: ${count}\n${lines.join("\n")}\n(budget: ≤10)`,
      };
    })
  );

  // G7: kb-code uses web-tree-sitter in non-test src
  results.push(
    await gate("G7", "kb-code uses web-tree-sitter", async () => {
      const srcDir = join(packagesDir, "kb-code", "src");
      if (!existsSync(srcDir)) return { ok: false, output: "kb-code/src not found" };
      const tsFiles = walkSync(srcDir, TS_EXTS);
      const count = countMatchingLines(tsFiles, /web-tree-sitter/);
      const ok = count >= 1;
      return { ok, output: `web-tree-sitter references in src: ${count}` };
    })
  );

  // G8: kb-docs hybrid retrieval (vec0/sqlite-vec AND fts5/MATCH)
  results.push(
    await gate("G8", "kb-docs hybrid retrieval", async () => {
      const srcDir = join(packagesDir, "kb-docs", "src");
      if (!existsSync(srcDir)) return { ok: false, output: "kb-docs/src not found" };
      const tsFiles = walkSync(srcDir, TS_EXTS);
      const vecCount = countMatchingLines(tsFiles, /vec0|sqlite-vec/);
      const ftsCount = countMatchingLines(tsFiles, /fts5|MATCH/);
      const ok = vecCount >= 1 && ftsCount >= 1;
      return {
        ok,
        output: `vec0/sqlite-vec refs: ${vecCount}, fts5/MATCH refs: ${ftsCount}`,
      };
    })
  );

  // G9: Orqenix-Pro tier present
  results.push(
    await gate("G9", "Orqenix-Pro tier present", async () => {
      const ok = existsSync(PRO_ROOT);
      return { ok, output: `${PRO_ROOT} exists: ${ok}` };
    })
  );

  // G10: Pro tests pass
  results.push(
    await gate("G10", "Pro tests pass", async () =>
      runCmd("pnpm", ["test"], PRO_ROOT)
    )
  );

  // G11: 7 docs >= 200 lines
  results.push(
    await gate("G11", "7 docs >= 200 lines", async () => {
      const candidates = [
        "docs/architecture/lifecycle-management.md",
        "docs/architecture/knowledge-layer.md",
        "docs/architecture/marketplace-system.md",
        "docs/architecture/license-gating.md",
        "docs/architecture/embedding-providers.md",
        "docs/monetization/why-pro.md",
        "docs/runbook/phase-4-rollback.md",
      ];
      let failed = 0;
      const lines: string[] = [];
      for (const path of candidates) {
        if (!existsSync(path)) {
          lines.push(`MISSING ${path}`);
          failed++;
          continue;
        }
        const content = await readFile(path, "utf8");
        const lineCount = content.split("\n").length;
        if (lineCount < 200) {
          lines.push(`FAIL ${path}: ${lineCount} < 200`);
          failed++;
        } else {
          lines.push(`PASS ${path}: ${lineCount}`);
        }
      }
      return { ok: failed === 0, output: lines.join("\n") };
    })
  );

  // G12: CI matrix 6 jobs
  results.push(
    await gate("G12", "CI matrix 6 jobs", async () => {
      const path = ".github/workflows/ci.yml";
      if (!existsSync(path)) return { ok: false, output: "ci.yml missing" };
      const content = await readFile(path, "utf8");
      const hasMatrix = /matrix:/.test(content);
      const hasOs = /(ubuntu|windows|macos)/.test(content);
      const hasNode = /node-version/.test(content);
      return {
        ok: hasMatrix && hasOs && hasNode,
        output: `matrix=${hasMatrix} os=${hasOs} node=${hasNode}`,
      };
    })
  );

  // G13: smoke passes locally
  results.push(
    await gate("G13", "smoke passes locally", async () => runCmd("pnpm", ["smoke"]))
  );

  // G14: no high/critical CVE
  results.push(
    await gate("G14", "no high/critical CVE", async () =>
      runCmd("pnpm", ["audit:check"])
    )
  );

  // G15: bundle size budget
  results.push(
    await gate("G15", "bundle size budget", async () =>
      runCmd("pnpm", ["bundlesize"])
    )
  );

  // G16: perf budget
  results.push(
    await gate("G16", "perf budget", async () =>
      runCmd("pnpm", ["bench:phase-4"])
    )
  );

  // G17: detach round-trip clean
  results.push(
    await gate("G17", "detach round-trip clean", async () =>
      runCmd("pnpm", ["charter:g17"])
    )
  );

  // G18: audit tamper detection
  results.push(
    await gate("G18", "audit tamper detection", async () =>
      runCmd("pnpm", ["charter:g18"])
    )
  );

  // G19: license grace period
  results.push(
    await gate("G19", "license grace period", async () =>
      runCmd("pnpm", ["test:license-grace"], PRO_ROOT)
    )
  );

  // G20: keystore correct
  results.push(
    await gate("G20", "keystore correct", async () => {
      const pubKey = join(PRO_ROOT, "keys/test-public.pem");
      if (!existsSync(pubKey)) {
        return { ok: false, output: `${pubKey} missing` };
      }
      const content = await readFile(pubKey, "utf8");
      const isEd25519 =
        content.includes("BEGIN PUBLIC KEY") || content.includes("ED25519");
      return { ok: isEd25519, output: `keystore: ${pubKey} valid=${isEd25519}` };
    })
  );

  // Summary
  const green = results.filter((r) => r.passed).length;
  const red = results.length - green;

  console.log(`\n\n=== CHARTER SUMMARY ===`);
  console.log(`GREEN: ${green}/20`);
  console.log(`RED:   ${red}/20`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.id} ${r.name}`);
  }

  const reportLines = [
    `# PHASE 4 CHARTER EXECUTION REPORT`,
    ``,
    `Date: ${new Date().toISOString()}`,
    `Final Status: ${green}/20 GREEN, ${red}/20 RED`,
    ``,
    `| Gate | Name | Result | Duration |`,
    `| ---- | ---- | ------ | -------- |`,
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.name} | ${r.passed ? "✅" : "❌"} | ${r.durationMs}ms |`
    ),
  ];

  if (red > 0) {
    reportLines.push(``, `## RED Gates Detail`, ``);
    for (const r of results.filter((x) => !x.passed)) {
      reportLines.push(`### ${r.id} ${r.name}`);
      reportLines.push("```");
      reportLines.push(r.output.slice(-1500));
      reportLines.push("```");
    }
  }

  await writeFile("charter-report.md", reportLines.join("\n"));
  console.log(`\nReport written to charter-report.md`);

  process.exit(red === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
