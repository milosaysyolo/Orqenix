import { performance } from 'node:perf_hooks';

export interface BenchOptions {
  name: string;
  phase: string;
  warmup?: number;
  iterations?: number;
  sloP95Ms?: number;
  sloMinOpsPerSec?: number;
  setup?: () => unknown | Promise<unknown>;
  teardown?: (ctx: unknown) => void | Promise<void>;
}

export interface BenchResult {
  name: string;
  phase: string;
  iterations: number;
  stats: {
    min: number; max: number; mean: number; median: number;
    p95: number; p99: number; stddev: number; opsPerSec: number;
  };
  memory: { heapUsedDeltaMb: number; rssDeltaMb: number };
  slo: { p95TargetMs: number | null; p95Pass: boolean | null; minOpsPerSec: number | null; opsPass: boolean | null };
  passed: boolean;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export async function bench(
  opts: BenchOptions,
  fn: (ctx: unknown, i: number) => unknown | Promise<unknown>
): Promise<BenchResult> {
  const warmup = opts.warmup ?? 20;
  const iterations = opts.iterations ?? 200;
  const ctx = opts.setup ? await opts.setup() : undefined;

  for (let i = 0; i < warmup; i++) await fn(ctx, i);

  if (global.gc) global.gc();
  const memBefore = process.memoryUsage();

  const durations = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn(ctx, i);
    durations[i] = performance.now() - t0;
  }

  const memAfter = process.memoryUsage();
  if (opts.teardown) await opts.teardown(ctx);

  const sorted = [...durations].sort((a, b) => a - b);
  const mean = durations.reduce((s, v) => s + v, 0) / durations.length;
  const total = durations.reduce((s, v) => s + v, 0);
  const opsPerSec = total > 0 ? (iterations / total) * 1000 : 0;
  const p95 = percentile(sorted, 95);
  const opsPerSecFinal = opsPerSec;

  const p95Target = opts.sloP95Ms ?? null;
  const p95Pass = p95Target === null ? null : p95 <= p95Target;
  const minOps = opts.sloMinOpsPerSec ?? null;
  const opsPass = minOps === null ? null : opsPerSecFinal >= minOps;

  return {
    name: opts.name,
    phase: opts.phase,
    iterations,
    stats: {
      min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0, mean,
      median: percentile(sorted, 50), p95, p99: percentile(sorted, 99),
      stddev: stddev(durations, mean), opsPerSec: opsPerSecFinal,
    },
    memory: {
      heapUsedDeltaMb: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
      rssDeltaMb: (memAfter.rss - memBefore.rss) / 1024 / 1024,
    },
    slo: { p95TargetMs: p95Target, p95Pass, minOpsPerSec: minOps, opsPass },
    passed: (p95Pass !== false) && (opsPass !== false),
  };
}

export function printResult(r: BenchResult): void {
  const flag = r.slo.p95TargetMs !== null ? (r.passed ? '\u2705' : '\u274C') : '  ';
  const sloStr = r.slo.p95TargetMs !== null
    ? ` [p95<${r.slo.p95TargetMs}ms ${r.slo.p95Pass ? 'PASS' : 'FAIL'}]` : '';
  console.log(
    `${flag} ${r.name.padEnd(42)} ` +
    `p50=${r.stats.median.toFixed(3)}ms p95=${r.stats.p95.toFixed(3)}ms ` +
    `p99=${r.stats.p99.toFixed(3)}ms ${Math.round(r.stats.opsPerSec).toLocaleString()} ops/s` + sloStr
  );
}

export class BenchSuite {
  readonly results: BenchResult[] = [];
  constructor(public readonly phase: string) {}
  async run(opts: Omit<BenchOptions, 'phase'>, fn: (ctx: unknown, i: number) => unknown | Promise<unknown>): Promise<BenchResult> {
    const r = await bench({ ...opts, phase: this.phase }, fn);
    this.results.push(r);
    printResult(r);
    return r;
  }
}
