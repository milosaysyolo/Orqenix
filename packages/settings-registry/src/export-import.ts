// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Export / Import
//
// Cross-machine settings portability per G64-06 + G64-07.
// Supports JSON + YAML formats with provenance metadata.

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type { SettingsRegistry } from './registry';
import {
  SettingsOverrideSchema,
  type SettingsOverride,
} from './types';

// ─────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Which levels to export (default: all) */
  level?: 'session' | 'branch' | 'project' | 'user' | 'system' | 'all';
  /** Output format (default: yaml) */
  format?: 'json' | 'yaml';
  /** Filter to a specific module (default: all modules) */
  moduleId?: string;
  /** User performing the export (for metadata) */
  exportedBy?: string;
}

export interface ExportedSettings {
  /** Export format version */
  version: 1;
  /** ISO timestamp */
  exported_at: string;
  /** Who exported */
  exported_by: string;
  /** Source metadata */
  source: {
    settingsRegistryVersion: string;
  };
  /** The overrides */
  overrides: SettingsOverride[];
}

const ExportedSettingsSchema = z.object({
  version: z.literal(1),
  exported_at: z.string().datetime(),
  exported_by: z.string(),
  source: z.object({
    settingsRegistryVersion: z.string(),
  }),
  overrides: z.array(SettingsOverrideSchema),
});

const REGISTRY_VERSION = '0.8.0-alpha.1';

/**
 * Exports settings overrides to a serialized string (JSON or YAML).
 *
 * Only explicit overrides are exported, NOT built-in defaults (those travel
 * with the code). Importing on another machine applies these overrides.
 */
export async function exportSettings(
  registry: SettingsRegistry,
  options: ExportOptions = {}
): Promise<string> {
  const format = options.format ?? 'yaml';
  const level = options.level ?? 'all';

  const persistence = registry.getPersistence();
  let overrides: SettingsOverride[] = options.moduleId
    ? await persistence.listByModule(options.moduleId)
    : await persistence.list();

  // Filter by level if not 'all'
  if (level !== 'all') {
    overrides = overrides.filter((o) => o.level === level);
  }

  const exported: ExportedSettings = {
    version: 1,
    exported_at: new Date().toISOString(),
    exported_by: options.exportedBy ?? 'unknown',
    source: { settingsRegistryVersion: REGISTRY_VERSION },
    overrides,
  };

  // Audit the export
  await registry.getAuditWriter().append({
    kind: 'settings.exported',
    ts: new Date().toISOString(),
    actor: { user: options.exportedBy ?? 'unknown' },
    payload: {
      level,
      format,
      overrideCount: overrides.length,
      ...(options.moduleId ? { moduleId: options.moduleId } : {}),
    },
  });

  if (format === 'json') {
    return JSON.stringify(exported, null, 2);
  }
  return stringifyYaml(exported, { indent: 2 });
}

// ─────────────────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────────────────

export interface ImportOptions {
  /** merge: add overrides without removing existing; replace: overwrite all */
  mode?: 'merge' | 'replace';
  /** User performing the import */
  importedBy?: string;
  /** Skip overrides for modules not currently registered (default: false = warn) */
  skipUnregistered?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
}

/**
 * Imports settings from a serialized string (auto-detects JSON vs YAML).
 *
 * - merge mode: applies imported overrides, keeping existing non-conflicting ones
 * - replace mode: clears existing overrides, then applies imported
 */
export async function importSettings(
  registry: SettingsRegistry,
  serialized: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const mode = options.mode ?? 'merge';
  const warnings: string[] = [];

  // Parse (try JSON first, fall back to YAML)
  let parsed: unknown;
  const trimmed = serialized.trim();
  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`Failed to parse JSON settings: ${(err as Error).message}`);
    }
  } else {
    try {
      parsed = parseYaml(trimmed);
    } catch (err) {
      throw new Error(`Failed to parse YAML settings: ${(err as Error).message}`);
    }
  }

  // Validate schema
  const result = ExportedSettingsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid settings export format: ${result.error.message}`
    );
  }

  const exported = result.data;
  const persistence = registry.getPersistence();

  // Replace mode: clear all existing overrides first
  if (mode === 'replace') {
    const existing = await persistence.list();
    for (const o of existing) {
      await persistence.delete(o.moduleId, o.settingPath, o.level, o.hierarchyId);
    }
  }

  // Apply imported overrides
  let imported = 0;
  let skipped = 0;
  const registeredModules = new Set(
    registry.listContracts().map((c) => c.moduleId)
  );

  for (const override of exported.overrides) {
    // Skip overrides for modules not registered
    if (!registeredModules.has(override.moduleId)) {
      if (options.skipUnregistered) {
        skipped += 1;
        continue;
      }
      warnings.push(
        `Override for unregistered module '${override.moduleId}' (setting: ${override.settingPath}). Applied anyway; register the module to use it.`
      );
    }

    await persistence.set({
      ...override,
      // Update metadata to reflect this import
      setAt: new Date().toISOString(),
      setBy: options.importedBy ?? override.setBy,
    });
    imported += 1;
  }

  // Audit the import
  await registry.getAuditWriter().append({
    kind: 'settings.imported',
    ts: new Date().toISOString(),
    actor: { user: options.importedBy ?? 'unknown' },
    payload: {
      mode,
      imported,
      skipped,
      warningCount: warnings.length,
      sourceExportedAt: exported.exported_at,
      sourceExportedBy: exported.exported_by,
    },
  });

  return { imported, skipped, warnings };
}
