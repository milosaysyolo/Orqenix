import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const pkgFiles = execSync('git ls-files "packages/*/package.json" "plugins/*/package.json"', {
  cwd: ROOT,
  encoding: "utf-8",
})
  .split("\n")
  .map((p) => p.trim())
  .filter(Boolean);

let changed = 0;

function rewriteImportField(value, pkgDir) {
  if (typeof value !== "string") return value;
  const mjsRel = value;
  const jsRel = value.replace(/\.mjs$/, ".js");
  if (mjsRel.endsWith(".mjs")) {
    const mjsAbs = join(pkgDir, mjsRel);
    const jsAbs = join(pkgDir, jsRel);
    if (!existsSync(mjsAbs) && existsSync(jsAbs)) {
      return jsRel;
    }
    if (!existsSync(mjsAbs) && !existsSync(jsAbs)) {
      return jsRel;
    }
  }
  return value;
}

for (const rel of pkgFiles) {
  const abs = join(ROOT, rel);
  const pkgDir = dirname(abs);
  const pkg = JSON.parse(await readFile(abs, "utf-8"));
  if (pkg.type !== "module") continue;

  let fileChanged = false;

  if (pkg.module?.endsWith(".mjs")) {
    const fixed = rewriteImportField(pkg.module, pkgDir);
    if (fixed !== pkg.module) {
      pkg.module = fixed;
      fileChanged = true;
    }
  }

  if (pkg.exports && typeof pkg.exports === "object") {
    for (const [subpath, cond] of Object.entries(pkg.exports)) {
      if (subpath === "./package.json" || typeof cond !== "object" || cond === null) continue;
      if (cond.import?.endsWith(".mjs")) {
        const fixed = rewriteImportField(cond.import, pkgDir);
        if (fixed !== cond.import) {
          console.log(`[align] ${pkg.name} ${subpath}: import ${cond.import} \u2192 ${fixed}`);
          cond.import = fixed;
          fileChanged = true;
        }
      }
    }
  }

  if (fileChanged) {
    await writeFile(abs, JSON.stringify(pkg, null, 2) + "\n");
    changed += 1;
  }
}

console.log(`\n[align-exports-to-tsup] ${changed} package(s) aligned.`);
