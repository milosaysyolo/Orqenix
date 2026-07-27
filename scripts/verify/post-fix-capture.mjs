import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const targets = [
  "@orqenix/memory-engine",
  "@orqenix/local-memory-federation",
  "@orqenix/self-learning-observer",
];

console.log("Post-fix vitest capture (verify binding resolution after fix-4)\n");

const ROOT = process.cwd();
const results = [];

const sharedPath = join(ROOT, "vitest.config.shared.ts");
const sharedExists = existsSync(sharedPath);
console.log(`vitest.config.shared.ts present: ${sharedExists ? "✓" : "✗"}`);
if (sharedExists) {
  const sharedContent = readFileSync(sharedPath, "utf-8");
  const hasNodePath = /NODE_PATH/.test(sharedContent);
  const hasExternal = /better-sqlite3/.test(sharedContent);
  console.log(`  NODE_PATH env injection: ${hasNodePath ? "✓" : "✗"}`);
  console.log(`  better-sqlite3 in externals: ${hasExternal ? "✓" : "✗"}`);
}

for (const target of targets) {
  console.log(`\n▶ Testing ${target}...`);
  const start = Date.now();
  const r = spawnSync("pnpm", ["--filter", target, "run", "test", "--reporter=verbose"], {
    encoding: "utf-8",
    shell: process.platform === "win32",
    timeout: 180000,
  });
  const durationMs = Date.now() - start;

  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  const bindingError =
    /Could not locate the bindings file|NODE_MODULE_VERSION|cannot find module 'better-sqlite3'/i.test(
      stdout + stderr,
    );
  const passMatch = /(\d+)\s+passed/.exec(stdout);
  const failMatch = /(\d+)\s+failed/.exec(stdout);

  results.push({
    target,
    exitCode: r.status,
    durationMs,
    bindingError,
    passed: passMatch ? +passMatch[1] : 0,
    failed: failMatch ? +failMatch[1] : r.status === 0 ? 0 : 1,
  });

  console.log(`  exit: ${r.status}, duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  pass: ${passMatch?.[1] ?? "?"}, fail: ${failMatch?.[1] ?? "?"}`);
  console.log(
    `  binding error detected: ${bindingError ? "❌ YES (fix did NOT work)" : "✅ NO (fix worked!)"}`,
  );
}

const report = {
  timestamp: new Date().toISOString(),
  platform: { os: process.platform, node: process.version },
  sharedConfig: { present: sharedExists },
  results,
  conclusion: results.every((r) => !r.bindingError)
    ? "BINDING FIX WORKS"
    : "BINDING FIX DID NOT WORK — need further investigation",
};

writeFileSync("post-fix-capture-report.json", JSON.stringify(report, null, 2));
console.log(`\n══ Conclusion ══`);
console.log(`  ${report.conclusion}`);
console.log(`  Report: post-fix-capture-report.json`);

process.exit(results.every((r) => !r.bindingError) ? 0 : 1);
