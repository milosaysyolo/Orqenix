import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const baselinePath = args.find((a) => a.startsWith('--baseline='))?.split('=')[1] ?? 'bench-baseline.json';
const threshold = Number(args.find((a) => a.startsWith('--threshold='))?.split('=')[1] ?? '20');

if (!existsSync('bench-results.json')) {
  console.error('\u274C bench-results.json not found. Run `pnpm bench` first.');
  process.exit(1);
}
const current = JSON.parse(readFileSync('bench-results.json', 'utf-8'));

if (!existsSync(baselinePath)) {
  console.log('\u26A0 No baseline at ' + baselinePath + '. Treating current run as the new baseline.');
  console.log('  To establish a baseline: cp bench-results.json bench-baseline.json');
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

const baseByName = new Map(baseline.results.map((r) => [r.name, r]));
const regressions = [];
const improvements = [];

for (const cur of current.results) {
  const base = baseByName.get(cur.name);
  if (!base) continue;
  const baseP95 = base.stats.p95;
  const curP95 = cur.stats.p95;
  if (baseP95 <= 0) continue;
  const deltaPct = ((curP95 - baseP95) / baseP95) * 100;
  if (deltaPct > threshold) {
    regressions.push({ name: cur.name, baseP95, curP95, deltaPct });
  } else if (deltaPct < -threshold) {
    improvements.push({ name: cur.name, baseP95, curP95, deltaPct });
  }
}

console.log('Performance regression gate (threshold \u00b1' + threshold + '% p95)\n');
console.log('Baseline: ' + baseline.timestamp + ' (' + (baseline.env?.platform) + ')');
console.log('Current:  ' + current.timestamp + ' (' + (current.env?.platform) + ')\n');

if (improvements.length > 0) {
  console.log('\ud83d\ude80 Improvements (' + improvements.length + '):');
  improvements.forEach((i) => console.log('   ' + i.name + ': ' + i.baseP95.toFixed(3) + 'ms \u2192 ' + i.curP95.toFixed(3) + 'ms (' + i.deltaPct.toFixed(1) + '%)'));
  console.log();
}

if (regressions.length > 0) {
  console.error('\u274C Regressions (' + regressions.length + '):');
  regressions.forEach((r) => console.error('   ' + r.name + ': ' + r.baseP95.toFixed(3) + 'ms \u2192 ' + r.curP95.toFixed(3) + 'ms (+' + r.deltaPct.toFixed(1) + '%)'));
  console.error('\n' + regressions.length + ' benchmark(s) regressed beyond ' + threshold + '%. Investigate before merge.');
  process.exit(1);
}

console.log('\u2705 No performance regressions beyond threshold.');
process.exit(0);
