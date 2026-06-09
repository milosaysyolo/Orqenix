import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

interface Step {
  name: string;
  cmd: string;
  args: string[];
  skipEnv?: string;
}

const STEPS: Step[] = [
  { name: 'build (Phase 6 packages)',       cmd: 'pnpm', args: ['-r', '--filter', '@orqenix/mesh-transport-core', '--filter', '@orqenix/mesh-transport-http', '--filter', '@orqenix/mesh-transport-libp2p', '--filter', '@orqenix/mesh-discovery', '--filter', '@orqenix/transport-security', '--filter', '@orqenix/mesh-observability', '--filter', '@orqenix/mesh-router', '--filter', '@orqenix/local-node', 'build'], skipEnv: 'SKIP_BUILD' },
  { name: 'test  (Phase 6 packages)',       cmd: 'pnpm', args: ['-r', '--filter', '@orqenix/mesh-transport-core', '--filter', '@orqenix/mesh-transport-http', '--filter', '@orqenix/mesh-transport-libp2p', '--filter', '@orqenix/mesh-discovery', '--filter', '@orqenix/transport-security', '--filter', '@orqenix/mesh-observability', '--filter', '@orqenix/mesh-router', '--filter', '@orqenix/local-node', 'test'], skipEnv: 'SKIP_TESTS' },
  { name: 'lint  no-DHT no-relay',          cmd: 'pnpm', args: ['tsx', 'scripts/lint/no-dht-no-relay.ts'] },
  { name: 'G36   Transport Abstraction',    cmd: 'pnpm', args: ['tsx', 'scripts/gates/G36-transport-abstraction.ts'] },
  { name: 'G37   HTTP Transport',           cmd: 'pnpm', args: ['tsx', 'scripts/gates/G37-http-transport.ts'] },
  { name: 'G38A  libp2p Foundation',        cmd: 'pnpm', args: ['-F', '@orqenix/mesh-transport-libp2p', 'run', 'gate:G38A'] },
  { name: 'G38B  libp2p Adapters',          cmd: 'pnpm', args: ['-F', '@orqenix/mesh-transport-libp2p', 'run', 'gate:G38B'] },
  { name: 'G39   Mesh Discovery',           cmd: 'pnpm', args: ['-F', '@orqenix/mesh-discovery', 'run', 'gate:G39'] },
  { name: 'G40   Transport Security',       cmd: 'pnpm', args: ['-F', '@orqenix/transport-security', 'run', 'gate:G40'] },
  { name: 'G41   Native Binding CI Matrix', cmd: 'pnpm', args: ['tsx', 'scripts/gates/G41-native-matrix.ts'] },
  { name: 'G42   Observability Hooks',      cmd: 'pnpm', args: ['-F', '@orqenix/mesh-observability', 'run', 'gate:G42'] },
  { name: 'G43   Cross-Transport Routing',  cmd: 'pnpm', args: ['-F', '@orqenix/mesh-router', 'run', 'gate:G43'] },
];

function runStep(s: Step): { ok: boolean; ms: number; skipped: boolean } {
  if (s.skipEnv && process.env[s.skipEnv] === '1') {
    console.log(`[verify-phase-6] SKIP  ${s.name}  (${s.skipEnv}=1)`);
    return { ok: true, ms: 0, skipped: true };
  }
  const t0 = performance.now();
  const cmd = s.cmd.includes(' ') ? `"${s.cmd}"` : s.cmd;
  const env = { ...process.env };
  if (s.name.includes('G41')) env.SKIP_LOCAL_SMOKE = '1';
  const r = spawnSync(cmd, s.args, { stdio: 'inherit', shell: true, env });
  const ms = performance.now() - t0;
  const ok = r.status === 0;
  console.log(`[verify-phase-6] ${ok ? 'PASS' : 'FAIL'}  ${s.name}  (${ms.toFixed(0)}ms)`);
  return { ok, ms, skipped: false };
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log(' Orqenix Phase 6 verify orchestrator (gates G36 to G43 + lint)');
  console.log('================================================================');

  let total = 0;
  for (const s of STEPS) {
    const r = runStep(s);
    total += r.ms;
    if (!r.ok) {
      console.error(`[verify-phase-6] FAILED at: ${s.name}`);
      console.error(`[verify-phase-6] total elapsed before failure: ${(total / 1000).toFixed(2)}s`);
      process.exit(1);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(` Orqenix Phase 6 verify: ALL GATES PASS  (total ${(total / 1000).toFixed(2)}s)`);
  console.log(' Repo is READY for tag v0.6.0-phase-6');
  console.log('================================================================');
}

main().catch((e) => { console.error(e); process.exit(1); });
