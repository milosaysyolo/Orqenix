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

const banner = (t) => { console.log('\n' + '\u2550'.repeat(78) + '\n  ' + t + '\n' + '\u2550'.repeat(78)); };

const allResults = [];
async function section(title, fn) {
  banner(title);
  const suite = await fn();
  allResults.push(...suite.results);
}

console.log('\n\ud83c\udfc1 Orqenix Performance Benchmark \u2014 Phase 1 \u2192 Phase 8\n');
console.log('   Node ' + process.version + ' \u00b7 ' + process.platform + '/' + process.arch + ' \u00b7 gc=' + (global.gc ? 'on' : 'off (run with --expose-gc)'));

const t0 = Date.now();
await section('PHASE 1-2 \u2014 Memory Engine Core', runPhase12);
await section('PHASE 3 \u2014 Storage (BLAKE3 + blob dedup)', runPhase3);
await section('PHASE 4 \u2014 Hybrid Search', runPhase4);
await section('PHASE 5 \u2014 Capability / Permission', runPhase5);
await section('PHASE 7 \u2014 Audit Chain (BLAKE3)', runPhase7);
await section('PHASE 8 \u2014 Hierarchy / Branch / Subagent', runPhase8);
await section('PHASE 8 \u2014 Normalization (round-trip)', runPhase8Norm);
await section('PHASE 8 \u2014 Self-Learning (detection)', runPhase8SelfLearning);
await section('MIGRATION', runMigration);

const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
const passed = allResults.filter((r) => r.passed).length;
const sloEnforced = allResults.filter((r) => r.slo.p95TargetMs !== null).length;
const sloFailed = allResults.filter((r) => r.slo.p95Pass === false).length;

banner('SUMMARY');
console.log('  Benchmarks run:       ' + allResults.length);
console.log('  SLO-enforced:         ' + sloEnforced);
console.log('  SLO passing:          ' + (sloEnforced - sloFailed) + '/' + sloEnforced);
console.log('  Total wall time:      ' + totalSec + 's');
if (sloFailed > 0) {
  console.log('\n  \u274C SLO violations:');
  allResults.filter((r) => r.slo.p95Pass === false).forEach((r) =>
    console.log('     ' + r.name + ' \u2014 p95=' + r.stats.p95.toFixed(3) + 'ms > target ' + r.slo.p95TargetMs + 'ms'));
}

const report = {
  timestamp: new Date().toISOString(),
  env: { node: process.version, platform: process.platform, arch: process.arch, gc: !!global.gc },
  totalSec: Number(totalSec),
  summary: { total: allResults.length, sloEnforced, sloFailed },
  results: allResults,
};
writeFileSync('bench-results.json', JSON.stringify(report, null, 2));
console.log('\n  Report: bench-results.json');
process.exit(sloFailed > 0 ? 1 : 0);
