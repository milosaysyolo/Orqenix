// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsRegistry } from '../src/registry';
import { exportSettings, importSettings } from '../src/export-import';
import { InMemorySettingsPersistence } from '../src/persistence';
import { InMemorySettingsAuditWriter } from '../src/types';
import type { ModuleSettingsContract } from '../src/types';

function contract(): ModuleSettingsContract {
  return {
    moduleId: '@orqenix/memory-engine',
    version: '0.8.0',
    settingsSchema: {},
    defaults: { 'hierarchy.level_boost.session': 1.5 },
    provenance: { phase: 8, crVersion: 'v8.0', rationale: 'test' },
    hotReloadable: false,
    hierarchyOverride: 'all',
  };
}

async function seed(registry: SettingsRegistry): Promise<void> {
  await registry.register(contract());
  await registry.update(
    '@orqenix/memory-engine',
    'hierarchy.level_boost.session',
    2.0,
    { level: 'project', hierarchyId: 'blake3:proj', setBy: 'milo' }
  );
}

describe('Export / Import', () => {
  let registry: SettingsRegistry;
  let audit: InMemorySettingsAuditWriter;

  beforeEach(() => {
    audit = new InMemorySettingsAuditWriter();
    registry = new SettingsRegistry({
      auditWriter: audit,
      persistence: new InMemorySettingsPersistence(),
    });
  });

  it('exports to YAML with metadata', async () => {
    await seed(registry);
    const yaml = await exportSettings(registry, {
      format: 'yaml',
      exportedBy: 'milo',
    });
    expect(yaml).toContain('version: 1');
    expect(yaml).toContain('exported_by: milo');
    expect(yaml).toContain('hierarchy.level_boost.session');
    expect(audit.getEvents().some((e) => e.kind === 'settings.exported')).toBe(true);
  });

  it('exports to JSON', async () => {
    await seed(registry);
    const json = await exportSettings(registry, { format: 'json' });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.overrides).toHaveLength(1);
  });

  it('round-trips export → import (merge)', async () => {
    await seed(registry);
    const yaml = await exportSettings(registry);

    // Fresh registry
    const registry2 = new SettingsRegistry({
      persistence: new InMemorySettingsPersistence(),
    });
    await registry2.register(contract());

    const result = await importSettings(registry2, yaml, { mode: 'merge' });
    expect(result.imported).toBe(1);

    const resolved = await registry2.resolve(
      '@orqenix/memory-engine',
      'hierarchy.level_boost.session',
      { projectId: 'blake3:proj' }
    );
    expect(resolved.value).toBe(2.0);
  });

  it('replace mode clears existing overrides first', async () => {
    await seed(registry);

    // Add a second override that's NOT in the import
    await registry.update(
      '@orqenix/memory-engine',
      'hierarchy.level_boost.session',
      9.0,
      { level: 'user', hierarchyId: 'milo@example.com' }
    );

    // Export only project-level
    const yaml = await exportSettings(registry, { level: 'project' });

    // Replace import (clears the user-level override too)
    await importSettings(registry, yaml, { mode: 'replace' });

    const userResolved = await registry.resolve(
      '@orqenix/memory-engine',
      'hierarchy.level_boost.session',
      { userId: 'milo@example.com' }
    );
    // user-level override was cleared by replace
    expect(userResolved.source).toBe('built-in-default');
  });

  it('warns on overrides for unregistered modules', async () => {
    await seed(registry);
    const yaml = await exportSettings(registry);

    const registry2 = new SettingsRegistry({
      persistence: new InMemorySettingsPersistence(),
    });
    // Do NOT register the module
    const result = await importSettings(registry2, yaml, { mode: 'merge' });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('unregistered module');
  });

  it('skips unregistered when skipUnregistered=true', async () => {
    await seed(registry);
    const yaml = await exportSettings(registry);

    const registry2 = new SettingsRegistry({
      persistence: new InMemorySettingsPersistence(),
    });
    const result = await importSettings(registry2, yaml, {
      mode: 'merge',
      skipUnregistered: true,
    });
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('rejects malformed import data', async () => {
    await expect(
      importSettings(registry, '{"version": 99}', { mode: 'merge' })
    ).rejects.toThrow();
  });

  it('auto-detects JSON vs YAML', async () => {
    await seed(registry);
    const json = await exportSettings(registry, { format: 'json' });

    const registry2 = new SettingsRegistry({
      persistence: new InMemorySettingsPersistence(),
    });
    await registry2.register(contract());

    // import JSON without specifying format (auto-detect by leading {)
    const result = await importSettings(registry2, json, { mode: 'merge' });
    expect(result.imported).toBe(1);
  });
});
