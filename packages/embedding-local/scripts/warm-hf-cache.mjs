#!/usr/bin/env node
/**
 * Pre-downloads HuggingFace models used by embedding-local tests so the
 * actual test run can operate fully offline (TRANSFORMERS_OFFLINE=1).
 * This eliminates HTTP 429 rate-limit flakes in CI.
 *
 * Run with network access enabled. Retries with exponential backoff to
 * absorb transient 429 responses.
 *
 * Usage: node scripts/warm-hf-cache.mjs
 */
import { pipeline, env } from "@xenova/transformers";

// Allow network for warming (do NOT set offline here)
env.allowLocalModels = true;
env.allowRemoteModels = true;

// Models used by embedding-local tests
const MODELS = [{ id: "Xenova/all-MiniLM-L6-v2", task: "feature-extraction" }];

const MAX_ATTEMPTS = 5;

async function warmModel({ id, task }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[warm-hf-cache] (${attempt}/${MAX_ATTEMPTS}) downloading ${id}`);
      await pipeline(task, id);
      console.log(`[warm-hf-cache] OK: ${id}`);
      return true;
    } catch (e) {
      const is429 = /429|rate limit|too many requests/i.test(e.message || "");
      const backoff = attempt * 15; // 15s, 30s, 45s, 60s, 75s
      console.error(
        `[warm-hf-cache] attempt ${attempt} failed${is429 ? " (429 rate limit)" : ""}: ${e.message}`,
      );
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[warm-hf-cache] giving up on ${id} after ${MAX_ATTEMPTS} attempts`);
        return false;
      }
      console.error(`[warm-hf-cache] retrying in ${backoff}s`);
      await new Promise((r) => setTimeout(r, backoff * 1000));
    }
  }
  return false;
}

let allOk = true;
for (const model of MODELS) {
  const ok = await warmModel(model);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error("[warm-hf-cache] one or more models failed to warm.");
  // Do NOT fail hard here: tests may still pass if a cached copy exists from
  // actions/cache restore. Exit 0 so the warm step is best-effort.
  process.exit(0);
}

console.log("[warm-hf-cache] all models warmed. Tests can run with TRANSFORMERS_OFFLINE=1.");
process.exit(0);
