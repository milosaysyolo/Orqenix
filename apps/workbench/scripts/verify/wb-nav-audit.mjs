// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const WB = "apps/workbench";
let problems = 0;

const NAV_HREFS = [
  "/",
  "/memory",
  "/branches",
  "/learning",
  "/agents/orchestrator",
  "/agents/runner",
  "/agents/sessions",
  "/agents/subagents",
  "/agents/mcp",
  "/agents/bindings",
  "/agents/network",
  "/marketplace",
  "/plugins",
  "/skills",
  "/mesh",
  "/audit",
  "/observability",
  "/settings",
];

console.log("\u2014 app-shell nav \u2014");
try {
  const shell = await readFile(join(ROOT, WB, "components/app-shell.tsx"), "utf-8");
  const linkSource = (shell.match(/<Link\b/g) ?? []).length;
  if (!/<nav\b/.test(shell)) {
    console.error("\u274c no <nav> in app-shell");
    problems++;
  }
  if (linkSource < 2) {
    console.error(
      "\u274c only " + linkSource + " <Link> in source (need \u22652 to produce 19 rendered links)",
    );
    problems++;
  }
  if (/\/ flex items|{it\.href}={/.test(shell)) {
    console.error("\u274c mangled Link leftovers (/ flex items or {it.href}={)");
    problems++;
  }
  const navItemCount = (shell.match(/item\.href|{ href:/g) ?? []).length;
  if (problems === 0)
    console.log(
      "\u2713 app-shell has <nav> + " +
        linkSource +
        " source <Link>s mapping " +
        navItemCount +
        " nav items",
    );
} catch (e) {
  console.error("\u274c app-shell.tsx: " + e.message);
  problems++;
}

console.log("\n\u2014 root layout wraps AppShell \u2014");
try {
  const layout = await readFile(join(ROOT, WB, "app/layout.tsx"), "utf-8");
  if (!/<AppShell>/.test(layout) || !/from '@\/components\/app-shell'/.test(layout)) {
    console.error("\u274c root layout does not wrap <AppShell>");
    problems++;
  } else console.log("\u2713 root layout wraps <AppShell>");
} catch (e) {
  console.error("\u274c app/layout.tsx: " + e.message);
  problems++;
}

console.log("\n\u2014 nav targets exist (no 404) \u2014");
const missing = [];
for (const href of NAV_HREFS) {
  const rel = href === "/" ? "app/(workbench)/page.tsx" : "app/(workbench)" + href + "/page.tsx";
  if (!existsSync(join(ROOT, WB, rel))) missing.push(href);
}
if (missing.length) {
  console.error("\u274c missing pages: " + missing.join(", "));
  problems++;
} else console.log("\u2713 all " + NAV_HREFS.length + " nav targets exist");

console.log("\n[wb-nav-audit] " + problems + " problem(s).");
process.exit(problems > 0 ? 1 : 0);
