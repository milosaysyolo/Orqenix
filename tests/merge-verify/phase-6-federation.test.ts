// SPDX-License-Identifier: Apache-2.0
// PHASE 6 SMOKE: scope identity + federation (cross-project links).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectDiscovery } from '@orqenix/local-memory-federation';

describe('PHASE 6 — LAN Mesh + Identity (Federation)', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await mkdtemp(join(tmpdir(), 'phase6-')); });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('project discovery registry CRUD works', async () => {
    const discovery = new ProjectDiscovery(join(tmpDir, 'projects.yaml'));
    await discovery.registerProject({
      id: 'blake3:aabbccdd00112233aabb' as never, name: 'p1', path: '/p1',
      registered_at: new Date().toISOString(), cross_project_sharing_enabled: false,
    });
    const projects = await discovery.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.id).toBe('blake3:aabbccdd00112233aabb');
  });

  it('federation-enabled filter respects opt-in (no-DHT default OFF)', async () => {
    const discovery = new ProjectDiscovery(join(tmpDir, 'projects.yaml'));
    await discovery.registerProject({
      id: 'blake3:deadbeef00000000aaaa' as never, name: 'off', path: '/off',
      registered_at: new Date().toISOString(), cross_project_sharing_enabled: false,
    });
    const enabled = await discovery.listFederationEnabledProjects();
    expect(enabled).toHaveLength(0);
  });
});
