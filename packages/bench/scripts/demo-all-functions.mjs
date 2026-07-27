/**
 * Orqenix Demo Performance Test — All Functions
 * Runs all benchmark suites and generates a comprehensive evaluation report.
 * Usage: node --expose-gc --import tsx scripts/demo-all-functions.mjs
 */

import { writeFileSync } from 'node:fs';
import { runPhase12 } from '../benchmarks/phase-1-2-memory.bench.ts';
import { runPhase3 } from '../benchmarks/phase-3-storage.bench.ts';
import { runPhase4 } from '../benchmarks/phase-4-search.bench.ts';
import { runPhase5 } from '../benchmarks/phase-5-capability.bench.ts';
import { runPhase7 } from '../benchmarks/phase-7-audit.bench.ts';
import { runPhase8 } from '../benchmarks/phase-8-hierarchy.bench.ts';
import { runPhase8Norm } from '../benchmarks/phase-8-normalization.bench.ts';
import { runPhase8SelfLearning } from '../benchmarks/phase-8-selflearning.bench.ts';
import { runMigration } from '../benchmarks/migration.bench.ts';

const banner = (t) => console.log('\n' + '═'.repeat(78) + '\n  ' + t + '\n' + '═'.repeat(78));

const allResults = [];
async function section(title, fn) {
  banner(title);
  const suite = await fn();
  allResults.push(...suite.results);
}

console.log('\n🏁 Orqenix Demo Performance Test — All Functions\n');
console.log(`   Node ${process.version} · ${process.platform}/${process.arch} · gc=${global.gc ? 'on' : 'off'}`);

const t0 = Date.now();

await section('PHASE 1-2 — Memory Engine Core', runPhase12);
await section('PHASE 3 — Storage (BLAKE3 + blob dedup)', runPhase3);
await section('PHASE 4 — Hybrid Search', runPhase4);
await section('PHASE 5 — Capability / Permission', runPhase5);
await section('PHASE 7 — Audit Chain (BLAKE3)', runPhase7);
await section('PHASE 8 — Hierarchy / Branch / Subagent', runPhase8);
await section('PHASE 8 — Normalization (round-trip)', runPhase8Norm);
await section('PHASE 8 — Self-Learning (detection)', runPhase8SelfLearning);
await section('MIGRATION', runMigration);

const totalSec = Number(((Date.now() - t0) / 1000).toFixed(1));
const passed = allResults.filter((r) => r.passed).length;
const sloEnforced = allResults.filter((r) => r.slo.p95TargetMs !== null).length;
const sloFailed = allResults.filter((r) => r.slo.p95Pass === false).length;

banner('SUMMARY');
console.log(`  Benchmarks run:       ${allResults.length}`);
console.log(`  SLO-enforced:         ${sloEnforced}`);
console.log(`  SLO passing:          ${sloEnforced - sloFailed}/${sloEnforced}`);
console.log(`  Total wall time:      ${totalSec}s`);
if (sloFailed > 0) {
  console.log('\n  ❌ SLO violations:');
  allResults.filter((r) => r.slo.p95Pass === false).forEach((r) =>
    console.log(`     ${r.name} — p95=${r.stats.p95.toFixed(3)}ms > target ${r.slo.p95TargetMs}ms`));
}

// ── Build report JSON ──
const report = {
  timestamp: new Date().toISOString(),
  env: { node: process.version, platform: process.platform, arch: process.arch, gc: !!global.gc },
  totalSec,
  summary: { total: allResults.length, sloEnforced, sloFailed },
  results: allResults,
};
writeFileSync('bench-results.json', JSON.stringify(report, null, 2));

// ── Evaluation ──
function evaluate(r) {
  if (r.slo.p95Pass === false) return 'FAIL';
  if (r.stats.p99 > (r.slo.p95TargetMs ?? Infinity) * 5) return 'WARN (p99 outlier)';
  if (r.memory.heapUsedDeltaMb > 50) return 'WARN (high heap)';
  return 'PASS';
}

const byPhase = new Map();
for (const r of allResults) {
  const list = byPhase.get(r.phase) ?? [];
  list.push(r);
  byPhase.set(r.phase, list);
}

// ── Markdown report ──
const lines = [];
lines.push('# Orqenix Demo Performance Report\n');
lines.push(`> Generated: ${report.timestamp}`);
lines.push(`> Environment: Node ${report.env.node} · ${report.env.platform}/${report.env.arch} · GC ${report.env.gc ? 'enabled' : 'disabled'}`);
lines.push(`> Total wall time: ${totalSec}s\n`);

lines.push('## Executive Summary\n');
lines.push(`| Metric | Value |`);
lines.push(`|---|---|`);
lines.push(`| Benchmarks | ${allResults.length} |`);
lines.push(`| SLO-enforced | ${sloEnforced} |`);
lines.push(`| SLO passing | ${sloEnforced - sloFailed}/${sloEnforced} |`);
lines.push(`| SLO violations | ${sloFailed} |`);
lines.push(`| Wall time | ${totalSec}s |\n`);

lines.push('## Phase-by-Phase Results\n');
for (const [phase, results] of byPhase) {
  lines.push(`### ${phase}\n`);
  lines.push('| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const ev = evaluate(r);
    lines.push(
      `| ${r.name} | ${r.stats.median.toFixed(3)} | ${r.stats.p95.toFixed(3)} | ${r.stats.p99.toFixed(3)} | ` +
      `${Math.round(r.stats.opsPerSec).toLocaleString()} | ${r.memory.heapUsedDeltaMb.toFixed(2)} | ${r.memory.rssDeltaMb.toFixed(2)} | ${ev} |`
    );
  }
  lines.push('');
}

lines.push('## Evaluation Matrix\n');
lines.push('| Benchmark | SLO Target | Actual p95 | Headroom | Assessment |');
lines.push('|---|---|---|---|---|');
for (const r of allResults) {
  if (r.slo.p95TargetMs === null) continue;
  const headroom = ((1 - r.stats.p95 / r.slo.p95TargetMs) * 100).toFixed(1);
  const assess = r.passed ? (Number(headroom) > 50 ? '✅ excellent' : '✅ OK') : '❌ over SLO';
  lines.push(`| ${r.name} | <${r.slo.p95TargetMs}ms | ${r.stats.p95.toFixed(3)}ms | ${headroom}% | ${assess} |`);
}

lines.push('\n## Throughput Leaders (Top 10 ops/sec)\n');
const sorted = [...allResults].sort((a, b) => b.stats.opsPerSec - a.stats.opsPerSec);
lines.push('| Rank | Benchmark | ops/sec |');
lines.push('|---|---|---|');
sorted.slice(0, 10).forEach((r, i) => {
  lines.push(`| ${i + 1} | ${r.name} | ${Math.round(r.stats.opsPerSec).toLocaleString()} |`);
});

lines.push('\n## Memory Footprint (Top 10 by heap Δ)\n');
const byHeap = [...allResults].sort((a, b) => b.memory.heapUsedDeltaMb - a.memory.heapUsedDeltaMb);
lines.push('| Rank | Benchmark | Heap Δ (MB) | RSS Δ (MB) |');
lines.push('|---|---|---|---|');
byHeap.slice(0, 10).forEach((r, i) => {
  lines.push(`| ${i + 1} | ${r.name} | ${r.memory.heapUsedDeltaMb.toFixed(2)} | ${r.memory.rssDeltaMb.toFixed(2)} |`);
});

lines.push('\n## Recommendations\n');
const violations = allResults.filter((r) => r.slo.p95Pass === false);
if (violations.length === 0) {
  lines.push('✅ All SLO targets met. No performance regressions detected.\n');
} else {
  lines.push(`⚠️ ${violations.length} SLO violation(s) detected:\n`);
  for (const r of violations) {
    lines.push(`- **${r.name}**: p95=${r.stats.p95.toFixed(3)}ms exceeds target ${r.slo.p95TargetMs}ms`);
  }
  lines.push('');
}

const highHeap = allResults.filter((r) => r.memory.heapUsedDeltaMb > 50);
if (highHeap.length > 0) {
  lines.push(`⚠️ ${highHeap.length} benchmark(s) with heap Δ > 50MB:`);
  for (const r of highHeap) {
    lines.push(`- **${r.name}**: ${r.memory.heapUsedDeltaMb.toFixed(2)}MB heap, ${r.memory.rssDeltaMb.toFixed(2)}MB RSS`);
  }
  lines.push('');
}

lines.push('---\n*Generated by Orqenix Demo Performance Test*');

const mdReport = lines.join('\n');
writeFileSync('DEMO-PERF-REPORT.md', mdReport);
console.log('\n  📄 Reports: bench-results.json + DEMO-PERF-REPORT.md');
process.exit(sloFailed > 0 ? 1 : 0);
