import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('bench-results.json', 'utf-8'));

const lines = [];
lines.push('# Orqenix Performance Benchmark Report\n');
lines.push('> Generated: ' + data.timestamp);
lines.push('> Environment: Node ' + data.env.node + ' \u00b7 ' + data.env.platform + '/' + data.env.arch + ' \u00b7 GC ' + (data.env.gc ? 'enabled' : 'disabled'));
lines.push('> Total wall time: ' + data.totalSec + 's\n');

lines.push('## Summary\n');
lines.push('- Benchmarks: **' + data.summary.total + '**');
lines.push('- SLO-enforced: **' + data.summary.sloEnforced + '**');
lines.push('- SLO violations: **' + data.summary.sloFailed + '**\n');

const byPhase = new Map();
for (const r of data.results) {
  const list = byPhase.get(r.phase) ?? [];
  list.push(r);
  byPhase.set(r.phase, list);
}

for (const [phase, results] of byPhase) {
  lines.push('## ' + phase + '\n');
  lines.push('| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap \u0394 (MB) | SLO |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const slo = r.slo.p95TargetMs !== null ? (r.passed ? '\u2705 <' + r.slo.p95TargetMs + 'ms' : '\u274C >' + r.slo.p95TargetMs + 'ms') : '\u2014';
    lines.push(
      '| ' + r.name + ' | ' + r.stats.median.toFixed(3) + ' | ' + r.stats.p95.toFixed(3) + ' | ' + r.stats.p99.toFixed(3) + ' | ' +
      Math.round(r.stats.opsPerSec).toLocaleString() + ' | ' + r.memory.heapUsedDeltaMb.toFixed(2) + ' | ' + slo + ' |'
    );
  }
  lines.push('');
}

lines.push('## CR v8.0 Quality Targets\n');
lines.push('| Target | Benchmark | Result |');
lines.push('|---|---|---|');
const crChecks = [
  { target: '<300ms cross-scope query', bench: 'hierarchy.query.3level' },
  { target: '<10ms capability verify', bench: 'permission.exact' },
  { target: '<10ms capability verify', bench: 'permission.prefix' },
];
for (const c of crChecks) {
  const r = data.results.find((x) => x.name === c.bench);
  const result = r ? (r.passed ? '\u2705 p95=' + r.stats.p95.toFixed(3) + 'ms' : '\u274C p95=' + r.stats.p95.toFixed(3) + 'ms') : 'n/a';
  lines.push('| ' + c.target + ' | ' + c.bench + ' | ' + result + ' |');
}

process.stdout.write(lines.join('\n') + '\n');
