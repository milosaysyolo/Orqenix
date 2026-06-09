import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadBootstrapFile } from '../src/bootstrap.js';
import { MeshDiscovery } from '../src/discovery.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

describe('Part 5 smoke: bootstrap parse + discovery events', () => {
  it('loads bootstrap.yaml and drives the event lifecycle on transport hints', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'orqenix-mesh-'));
    try {
      const path = join(dir, 'bootstrap.yaml');
      await writeFile(
        path,
        `bootstrap:
  - /ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha
reconnect:
  initial_delay_ms: 50
  max_delay_ms: 200
  backoff_factor: 2
  jitter: false
`,
        'utf8',
      );

      const cfg = await loadBootstrapFile(path);
      const d = new MeshDiscovery({ bootstrap: cfg });

      const events: string[] = [];
      d.on((e) => events.push(e.state));

      const S = 'scp_b3_aa' as ScopeId;
      d.onMdnsPeerFound(S, cfg.bootstrap, '12D3KooWExamplePeerIdForLanScopeAlpha');
      d.markConnecting(S);
      d.markConnected(S);
      d.markStale(S);
      d.markConnected(S);
      d.onMdnsPeerLost(S);

      expect(events).toEqual(['Discovered', 'Connecting', 'Connected', 'Stale', 'Connected', 'Lost']);
      d.stop();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
