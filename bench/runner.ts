import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface Threshold {
  p50Ms: number;
  p95Ms: number;
  iterations: number;
  warmupIterations?: number;
}

interface Thresholds {
  [key: string]: Threshold;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

interface Report {
  name: string;
  iterations: number;
  warmupIterations: number;
  p50: number;
  p95: number;
  threshold: Threshold;
  passed: boolean;
  rawSamples: number[];
}

async function runBench(
  name: string,
  threshold: Threshold
): Promise<Report> {
  const warmup = threshold.warmupIterations ?? 1;
  const totalIterations = threshold.iterations + warmup;

  const benchUrl = pathToFileURL(
    join(__dirname, `${name}.bench.ts`)
  ).href;
  const mod = await import(benchUrl);
  const fnKey = Object.keys(mod).find((k) => k.startsWith("bench"));
  if (!fnKey) {
    throw new Error(`No bench export in ${name}.bench.ts`);
  }
  const fn = mod[fnKey]!;
  if (typeof fn !== "function") {
    throw new Error(`No bench export in ${name}.bench.ts`);
  }

  console.log(
    `Running ${name} x${totalIterations} (${warmup} warmup + ${threshold.iterations} measured)...`
  );
  const allSamples: number[] = await fn(totalIterations);
  const measuredSamples = allSamples.slice(warmup);

  const p50 = percentile(measuredSamples, 50);
  const p95 = percentile(measuredSamples, 95);
  const passed = p50 <= threshold.p50Ms && p95 <= threshold.p95Ms;

  return {
    name,
    iterations: threshold.iterations,
    warmupIterations: warmup,
    p50,
    p95,
    threshold,
    passed,
    rawSamples: allSamples,
  };
}

async function main() {
  const raw = await readFile(join(__dirname, "thresholds.json"), "utf8");
  const thresholds: Thresholds = JSON.parse(raw);

  const reports: Report[] = [];
  for (const [name, threshold] of Object.entries(thresholds)) {
    reports.push(await runBench(name, threshold));
  }

  await mkdir(join(ROOT, "bench-results"), { recursive: true });
  await writeFile(
    join(ROOT, "bench-results", "phase-4.json"),
    JSON.stringify(reports, null, 2)
  );

  let failed = 0;
  for (const r of reports) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log(
      `${status} ${r.name}: p50=${r.p50.toFixed(1)}ms (≤${r.threshold.p50Ms}) p95=${r.p95.toFixed(1)}ms (≤${r.threshold.p95Ms}) [${r.warmupIterations} warmup discarded]`
    );
    if (!r.passed) failed++;
  }

  if (failed > 0) {
    console.error(`\n${failed} benchmark(s) over budget`);
    process.exit(1);
  }
  console.log(`\nAll benchmarks within budget`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
