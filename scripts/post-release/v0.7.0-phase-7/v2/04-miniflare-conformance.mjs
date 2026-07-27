#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE = process.env.ITEM_EVIDENCE_DIR || resolve(process.cwd(), "out/item-4");
mkdirSync(EVIDENCE, { recursive: true });

const ADAPTER = resolve(process.cwd(), "packages/cloud-adapter-cloudflare");
if (!existsSync(ADAPTER)) {
  console.log("[04] cloud-adapter-cloudflare not found — SKIP");
  process.exit(2);
}

console.log("[04] Installing miniflare + wrangler...");
const install = spawnSync(
  "pnpm",
  [
    "--filter",
    "@orqenix-cloud/cloud-adapter-cloudflare",
    "add",
    "-D",
    "miniflare@^3",
    "wrangler@^3",
  ],
  { encoding: "utf8", cwd: process.cwd(), timeout: 5 * 60 * 1000 },
);
writeFileSync(resolve(EVIDENCE, "install.log"), `${install.stdout || ""}\n${install.stderr || ""}`);

if (install.status !== 0) {
  console.error("[04] FAIL: deps install");
  process.exit(1);
}

console.log("[04] Running miniflare conformance...");
const conf = spawnSync(
  "pnpm",
  [
    "--filter",
    "@orqenix-cloud/cloud-adapter-cloudflare",
    "exec",
    "vitest",
    "tests/miniflare-conformance.spec.ts",
    "--run",
  ],
  { encoding: "utf8", cwd: process.cwd(), timeout: 10 * 60 * 1000 },
);
writeFileSync(resolve(EVIDENCE, "conformance.log"), `${conf.stdout || ""}\n${conf.stderr || ""}`);

if (conf.status !== 0) {
  console.error("[04] FAIL: conformance suite");
  console.error((conf.stdout || "").slice(-2000));
  process.exit(1);
}

const log = readFileSync(resolve(EVIDENCE, "conformance.log"), "utf8");
const bindings = ["KV", "R2", "DurableObject", "Service", "Queue"].filter((b) =>
  new RegExp(`${b}.*binding|binding.*${b}`, "i").test(log),
);

if (bindings.length < 3) {
  console.error(`[04] Only ${bindings.length}/5 bindings detected: ${bindings.join(", ")}`);
  process.exit(1);
}

console.log(`[04] miniflare ${bindings.length} binding(s) verified: ${bindings.join(", ")} — PASS`);
