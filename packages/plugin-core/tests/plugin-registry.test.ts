// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../src/plugin-registry';
import {
  PluginAlreadyRegisteredError,
  PluginNotRegisteredError,
} from '../src/errors';
import type { PluginDiscoveryResult } from '../src/types';
import type { CanonicalSkillFormat } from '../src/csf-schema';

function makeDiscovery(name: string, kind = 'skill'): PluginDiscoveryResult {
  const csf: CanonicalSkillFormat = {
    name,
    version: '1.0.0',
    kind: kind as CanonicalSkillFormat['kind'],
    manifestVersion: '1.0',
    manifest: {
      permissions: ['scope.read'],
      external_agent_compat: ['claude-code'],
      license: 'Apache-2.0',
      keywords: [],
      compatibility: { orqenix: '>=0.8.0' },
      settingsHotReloadable: false,
      settingsHierarchyOverride: 'project',
      sandboxMode: 'separate_process',
    },
    implementation: { language: 'typescript', entry: './plugin.js' },
    provenance: { verification_status: 'unverified', contentHash: 'abc123def4567890' },
  };
  return {
    csf,
    packagePath: `/plugins/${name}`,
    entryPath: `/plugins/${name}/plugin.js`,
    isValidPlugin: true,
    issues: [],
  };
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(async () => {
    registry = new PluginRegistry();
    await registry.init();
  });

  it('registers a plugin (transitions to installed)', async () => {
    const entry = await registry.register(makeDiscovery('@a/skill'));
    expect(entry.state).toBe('installed');
    expect(registry.count()).toBe(1);
  });

  it('rejects duplicate registration', async () => {
    await registry.register(makeDiscovery('@a/skill'));
    await expect(
      registry.register(makeDiscovery('@a/skill'))
    ).rejects.toBeInstanceOf(PluginAlreadyRegisteredError);
  });

  it('transitions state and resets crash count on activate', async () => {
    await registry.register(makeDiscovery('@a/skill'));
    await registry.recordCrash('@a/skill');
    expect(registry.get('@a/skill').crashCount).toBe(1);

    await registry.setState('@a/skill', 'active');
    const entry = registry.get('@a/skill');
    expect(entry.state).toBe('active');
    expect(entry.crashCount).toBe(0);
    expect(entry.lastActivatedAt).not.toBeNull();
  });

  it('records invocation stats', async () => {
    await registry.register(makeDiscovery('@a/skill'));
    await registry.recordInvocation('@a/skill', true);
    await registry.recordInvocation('@a/skill', true);
    await registry.recordInvocation('@a/skill', false);

    const entry = registry.get('@a/skill');
    expect(entry.totalInvocations).toBe(2);
    expect(entry.totalErrors).toBe(1);
  });

  it('updates plugin to new version', async () => {
    await registry.register(makeDiscovery('@a/skill'));
    const updated = makeDiscovery('@a/skill');
    updated.csf.version = '2.0.0';
    const result = await registry.update('@a/skill', updated.csf, '/plugins/new');
    expect(result.csf.version).toBe('2.0.0');
    expect(result.state).toBe('installed');
  });

  it('unregisters a plugin', async () => {
    await registry.register(makeDiscovery('@a/skill'));
    await registry.unregister('@a/skill');
    expect(registry.count()).toBe(0);
    expect(registry.find('@a/skill')).toBeNull();
  });

  it('throws when unregistering unknown plugin', async () => {
    await expect(registry.unregister('@nope/x')).rejects.toBeInstanceOf(
      PluginNotRegisteredError
    );
  });

  it('lists by state and by kind', async () => {
    await registry.register(makeDiscovery('@a/skill', 'skill'));
    await registry.register(makeDiscovery('@b/embed', 'embedding-model'));
    await registry.setState('@a/skill', 'active');

    expect(registry.listByState('active')).toHaveLength(1);
    expect(registry.listByState('installed')).toHaveLength(1);
    expect(registry.listByKind('skill')).toHaveLength(1);
    expect(registry.listByKind('embedding-model')).toHaveLength(1);
  });
});
