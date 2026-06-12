// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsResolver, getByPath } from '../src/resolver';
import { InMemorySettingsPersistence } from '../src/persistence';
import type { ModuleSettingsContract } from '../src/types';

function makeContract(
  hierarchyOverride: ModuleSettingsContract['hierarchyOverride'] = 'all'
): ModuleSettingsContract {
  return {
    moduleId: '@orqenix/memory-engine',
    version: '0.8.0',
    settingsSchema: {},
    defaults: {
      'hierarchy.level_boost.session': 1.5,
      'hierarchy.level_boost.branch': 1.2,
      'hierarchy.level_boost.project': 1.0,
    },
    provenance: { phase: 8, crVersion: 'v8.0', rationale: 'test' },
    hotReloadable: true,
    hierarchyOverride,
  };
}

describe('SettingsResolver', () => {
  let persistence: InMemorySettingsPersistence;
  let resolver: SettingsResolver;

  beforeEach(() => {
    persistence = new InMemorySettingsPersistence();
    resolver = new SettingsResolver(persistence);
  });

  it('returns built-in default when no overrides', async () => {
    const resolved = await resolver.resolve(
      makeContract(),
      'hierarchy.level_boost.session',
      {}
    );
    expect(resolved.value).toBe(1.5);
    expect(resolved.source).toBe('built-in-default');
    expect(resolved.inherits).toBe(true);
  });

  it('resolves project-level override', async () => {
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'project',
      hierarchyId: 'blake3:proj',
      value: 2.0,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });

    const resolved = await resolver.resolve(
      makeContract(),
      'hierarchy.level_boost.session',
      { projectId: 'blake3:proj' }
    );
    expect(resolved.value).toBe(2.0);
    expect(resolved.source).toBe('project');
    expect(resolved.inherits).toBe(false);
  });

  it('session override takes precedence over project', async () => {
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'project',
      hierarchyId: 'blake3:proj',
      value: 2.0,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'session',
      hierarchyId: 'sess-1',
      value: 3.0,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });

    const resolved = await resolver.resolve(
      makeContract(),
      'hierarchy.level_boost.session',
      { sessionId: 'sess-1', projectId: 'blake3:proj' }
    );
    expect(resolved.value).toBe(3.0);
    expect(resolved.source).toBe('session');
  });

  it('respects hierarchyOverride=project (session override ignored)', async () => {
    // module only allows project+ override
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'session',
      hierarchyId: 'sess-1',
      value: 3.0,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });

    const resolved = await resolver.resolve(
      makeContract('project'),
      'hierarchy.level_boost.session',
      { sessionId: 'sess-1' }
    );
    // session override skipped because module only permits project+
    expect(resolved.value).toBe(1.5);
    expect(resolved.source).toBe('built-in-default');
  });

  it('respects hierarchyOverride=none (only system can override)', async () => {
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'project',
      hierarchyId: 'blake3:proj',
      value: 2.0,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });

    const resolved = await resolver.resolve(
      makeContract('none'),
      'hierarchy.level_boost.session',
      { projectId: 'blake3:proj' }
    );
    expect(resolved.value).toBe(1.5);
    expect(resolved.source).toBe('built-in-default');
  });

  it('user-level override applies when no session/branch/project', async () => {
    await persistence.set({
      moduleId: '@orqenix/memory-engine',
      settingPath: 'hierarchy.level_boost.session',
      level: 'user',
      hierarchyId: 'milo@example.com',
      value: 1.8,
      setAt: new Date().toISOString(),
      setBy: 'milo',
    });

    const resolved = await resolver.resolve(
      makeContract(),
      'hierarchy.level_boost.session',
      { userId: 'milo@example.com' }
    );
    expect(resolved.value).toBe(1.8);
    expect(resolved.source).toBe('user');
  });

  it('resolveValue returns value directly', async () => {
    const value = await resolver.resolveValue(
      makeContract(),
      'hierarchy.level_boost.branch',
      {}
    );
    expect(value).toBe(1.2);
  });

  it('getByPath navigates nested objects', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getByPath(obj, 'a.b.c')).toBe(42);
    expect(getByPath(obj, 'a.b')).toEqual({ c: 42 });
    expect(getByPath(obj, 'a.x.y')).toBeUndefined();
  });
});
