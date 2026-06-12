// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRuntime, SkillNotFoundError } from '../src/runtime';
import { PluginRegistry } from '@orqenix/plugin-core';
import type { PluginDiscoveryResult } from '@orqenix/plugin-core';

function makeSkillDiscovery(name: string): PluginDiscoveryResult {
  return {
    csf: {
      name,
      version: '1.0.0',
      kind: 'skill',
      manifestVersion: '1.0',
      manifest: {
        tool: {
          name: 'do_thing',
          description: 'Does a thing',
          inputSchema: { type: 'object', required: ['x'] },
          outputSchema: { type: 'object', required: ['result'] },
        },
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
      provenance: { verification_status: 'verified', contentHash: 'abc1234567890def' },
    },
    packagePath: `/plugins/${name}`,
    entryPath: `/plugins/${name}/plugin.js`,
    isValidPlugin: true,
    issues: [],
  };
}

describe('SkillRuntime', () => {
  let registry: PluginRegistry;
  let runtime: SkillRuntime;

  beforeEach(async () => {
    registry = new PluginRegistry();
    await registry.init();
    // Mock sandbox manager that returns a canned result
    const sandboxManager = {
      isActive: () => true,
      activate: async () => ({}),
      invoke: async () => ({
        output: { result: 'done' },
        durationMs: 10,
        inputHash: 'ih',
        outputHash: 'oh',
      }),
    };
    runtime = new SkillRuntime({
      engine: {} as never,
      registry,
      sandboxManager: sandboxManager as never,
    });
  });

  it('throws SkillNotFoundError for unregistered skill', async () => {
    await expect(
      runtime.invoke('@nope/skill', {}, { clientId: 'test' })
    ).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it('invokes a registered skill', async () => {
    await registry.register(makeSkillDiscovery('@example/skill'));
    const result = await runtime.invoke(
      '@example/skill',
      { x: 1 },
      { clientId: 'test' }
    );
    expect(result.output).toEqual({ result: 'done' });
    expect(result.outputValid).toBe(true);
  });

  it('rejects input missing required field', async () => {
    await registry.register(makeSkillDiscovery('@example/skill2'));
    await expect(
      runtime.invoke('@example/skill2', {}, { clientId: 'test' })
    ).rejects.toThrow(/Missing required input field: x/);
  });

  it('lists installed skills', async () => {
    await registry.register(makeSkillDiscovery('@example/skill3'));
    const skills = runtime.listSkills();
    expect(skills.length).toBe(1);
    expect(skills[0]?.csf.kind).toBe('skill');
  });
});
