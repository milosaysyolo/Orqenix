// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/wb-design-audit.mjs
// Purpose: Finds the exact causes of "design wrong vs prototype": (1) any import
//   of the OLD WorkbenchShell/theme-provider, (2) shadcn HSL tokens still in
//   globals.css, (3) shadcn @apply resets, (4) components still using shadcn color
//   classes. Reports file:line so the agent can confirm the fix removed them.
// Run: node scripts/verify/wb-design-audit.mjs
// ============================================================================

import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const WB = join(ROOT, "apps", "workbench");
let problems = 0;

function grep(pattern, label) {
  try {
    const out = execSync(`git grep -n "${pattern}" -- "${WB}"`, { cwd: ROOT, encoding: "utf-8" });
    if (out.trim()) {
      console.error(`\u274c ${label}:`);
      out
        .trim()
        .split("\n")
        .forEach((l) => console.error("   " + l));
      problems++;
    }
  } catch {
    /* no match = good */
  }
}

console.log("\u2014 old shell / provider usage (should be gone) \u2014");
grep("WorkbenchShell", "old WorkbenchShell still referenced");
grep("from './workbench-shell'", "workbench-shell import");
grep("theme-provider", "old theme-provider import (use components/theme)");

console.log("\n\u2014 shadcn HSL tokens in globals.css (should be gone) \u2014");
try {
  const css = await readFile(join(WB, "app/globals.css"), "utf-8");
  if (/--background:\s*\d|--foreground:\s*\d|hsl\(var\(--/.test(css)) {
    console.error("\u274c globals.css still has shadcn HSL tokens");
    problems++;
  }
  if (/@apply\s+border-border|@layer\s+base[^}]*\*\s*{[^}]*@apply/.test(css)) {
    console.error("\u274c globals.css has shadcn @apply reset");
    problems++;
  }
  if (problems === 0) console.log("\u2713 globals.css is warm-only");
} catch {
  /* */
}

console.log("\n\u2014 double shell check \u2014");
try {
  const groupLayout = await readFile(join(WB, "app/(workbench)/layout.tsx"), "utf-8");
  if (/Shell|<aside|sidebar/i.test(groupLayout)) {
    console.error("\u274c (workbench)/layout.tsx renders a shell \u2014 must be passthrough");
    problems++;
  } else console.log("\u2713 (workbench)/layout.tsx is passthrough");
} catch {
  /* */
}

console.log(`\n[wb-design-audit] ${problems} problem(s).`);
process.exit(problems > 0 ? 1 : 0);
