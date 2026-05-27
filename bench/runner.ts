import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ThresholdConfig {
  p50Ms: number;
  p95Ms: number;
  iterations: number;
}

type BenchFn = (iterations: number) => Promise<number[]>;

function p50(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.5)];
}

function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}

async function runAll(): Promise<boolean> {
  const thresholds = JSON.parse(
    readFileSync(resolve(__dirname, "thresholds.json"), "utf-8"),
  ) as Record<string, ThresholdConfig>;

  let allPass = true;

  for (const [benchName, cfg] of Object.entries(thresholds)) {
    const mod = await import(pathToFileURL(resolve(__dirname, `${benchName}.bench.ts`)).href);
    const fnKey = Object.keys(mod).find((k) => k.startsWith("bench"));
    if (!fnKey) {
      console.error(`No bench* export found in ${benchName}.bench.ts`);
      allPass = false;
      continue;
    }
    const fn = mod[fnKey] as BenchFn;
    const samples = await fn(cfg.iterations);
    const p50Val = p50(samples);
    const p95Val = p95(samples);
    const pass = p50Val <= cfg.p50Ms && p95Val <= cfg.p95Ms;
    console.log(
      `[${pass ? "PASS" : "FAIL"}] ${benchName}: p50=${p50Val.toFixed(1)}ms (≤${cfg.p50Ms}), p95=${p95Val.toFixed(1)}ms (≤${cfg.p95Ms})`,
    );
    if (!pass) allPass = false;
  }

  return allPass;
}

const ok = await runAll();
process.exit(ok ? 0 : 1);
