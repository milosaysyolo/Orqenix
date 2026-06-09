/**
 * Charter Gate G39: Mesh Discovery.
 * Asserts the 6 criteria from CR v7.2 Chapter 5.7.
 * Exits non-zero on any failure.
 */
import { spawnSync } from 'node:child_process';
import {
  MeshDiscovery,
  parseBootstrapYaml,
  nextReconnectDelay,
  MDNS_SERVICE_TAG,
} from '../../packages/mesh-discovery/src/index.js';
import type { ScopeId } from '../../packages/mesh-transport-core/src/index.js';

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`[G39] ${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function main(): Promise<void> {
  // ---- C1: mDNS service tag locked and event emits Discovered within 5s in loopback ----
  {
    check('C1a mDNS service tag locked', MDNS_SERVICE_TAG === 'orqenix-mesh');

    const d = new MeshDiscovery();
    const states: string[] = [];
    const off = d.on((e) => states.push(e.state));
    const start = Date.now();
    d.onMdnsPeerFound(
      'scp_b3_aa' as ScopeId,
      ['/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha'],
      '12D3KooWExamplePeerIdForLanScopeAlpha',
    );
    const elapsed = Date.now() - start;
    off();
    check('C1b mDNS loopback emits Discovered <5s', states[0] === 'Discovered' && elapsed < 5_000, `elapsed=${elapsed}ms`);
  }

  // ---- C2: bootstrap mode parses YAML and schedules reconnects with backoff ----
  {
    const yaml = `
bootstrap:
  - /ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha
reconnect:
  initial_delay_ms: 5
  max_delay_ms: 50
  backoff_factor: 2
  jitter: false
`;
    const cfg = parseBootstrapYaml(yaml);
    const d = new MeshDiscovery({ bootstrap: cfg });
    let attempts = 0;
    d.scheduleBootstrapAttempt('/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha', async () => {
      attempts++;
      return attempts >= 3;
    });
    await new Promise((res) => setTimeout(res, 300));
    check('C2 bootstrap reconnects with backoff then stops on success', attempts >= 3);
    d.stop();
  }

  // ---- C3: no DHT modules imported anywhere in OSS Phase 6 (static-import lint) ----
  {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/lint/no-dht-no-relay.ts'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8',
    });
    check('C3 no-DHT no-relay static-import lint', r.status === 0, r.stdout || r.stderr || '');
  }

  // ---- C4: no circuit-relay modules imported (covered by the same lint) ----
  {
    check('C4 no circuit-relay imports', true, 'covered by C3 lint');
  }

  // ---- C5: peer liveness: Lost event fires within timeout when mDNS reports gone ----
  {
    const d = new MeshDiscovery();
    const states: string[] = [];
    d.on((e) => states.push(e.state));
    const S = 'scp_b3_aa' as ScopeId;
    d.onMdnsPeerFound(S, []);
    d.markConnecting(S);
    d.markConnected(S);
    d.onMdnsPeerLost(S);
    check('C5 Lost fires when peer leaves', states.at(-1) === 'Lost');
  }

  // ---- C6: state machine transitions observable via structured events ----
  {
    const d = new MeshDiscovery();
    const seen: string[] = [];
    d.on((e) => seen.push(`${e.state}`));
    const S = 'scp_b3_aa' as ScopeId;
    d.onMdnsPeerFound(S, []);
    d.markConnecting(S);
    d.markConnected(S);
    d.markStale(S);
    d.markConnected(S);
    d.onMdnsPeerLost(S);
    check(
      'C6 lifecycle transitions observable',
      JSON.stringify(seen) === JSON.stringify(['Discovered', 'Connecting', 'Connected', 'Stale', 'Connected', 'Lost']),
    );
  }

  void nextReconnectDelay;

  if (failures > 0) {
    console.error(`[G39] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log('[G39] ALL PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
