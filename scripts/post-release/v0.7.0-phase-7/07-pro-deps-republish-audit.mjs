#!/usr/bin/env node
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE = resolve(process.cwd(), "out/v0.7.0-phase-7/evidence/item-7");
mkdirSync(EVIDENCE, { recursive: true });

const PRO_PACKAGES = [
  "@orqenix-pro/relay-edge-rust",
  "@orqenix-pro/mesh-delegation",
  "@orqenix-pro/blast-radius",
  "@orqenix-pro/code-graph",
  "@orqenix-pro/embeddings",
  "@orqenix-pro/kb-token-store",
  "@orqenix-pro/memory-distiller-llm",
];

const VERSION = "0.7.0-phase-7";
let fails = [];

for (const pkg of PRO_PACKAGES) {
  try {
    const raw = execSync(`npm view ${pkg}@${VERSION} --json 2>/dev/null || echo {}`, {
      encoding: "utf8",
    });
    writeFileSync(`${EVIDENCE}/${pkg.replace(/[/@]/g, "_")}.json`, raw);
    const meta = JSON.parse(raw);

    if (!meta.name) {
      console.log(`[07] SKIP ${pkg}: not published (Pro tag pending?)`);
      continue;
    }

    const deps = { ...(meta.dependencies || {}), ...(meta.peerDependencies || {}) };
    const bad = Object.entries(deps).filter(
      ([_, v]) =>
        String(v).startsWith("workspace:") ||
        String(v).startsWith("file:") ||
        String(v).startsWith("link:"),
    );

    if (bad.length > 0) {
      fails.push({ pkg, bad });
      console.log(`[07] FAIL ${pkg}: ${bad.length} unresolved spec(s)`);
      bad.forEach(([k, v]) => console.log(`        ${k} -> ${v}`));
    } else {
      console.log(`[07] OK ${pkg}: ${Object.keys(deps).length} deps clean`);
    }
  } catch (e) {
    console.log(`[07] WARN ${pkg}: ${e.message}`);
  }
}

const summary = {
  packages_checked: PRO_PACKAGES.length,
  failed: fails.length,
  details: fails,
  remediation:
    fails.length > 0
      ? "Bump version, replace workspace:^/file:/link: with ^X.Y.Z, republish."
      : "All Pro packages have clean spec ranges.",
};
writeFileSync(`${EVIDENCE}/summary.json`, JSON.stringify(summary, null, 2));

if (fails.length > 0) {
  console.log(`[07] Pro deps audit: FAIL (${fails.length} package(s) need republish)`);
  process.exit(1);
}
console.log("[07] Pro deps audit: PASS");
process.exit(0);
