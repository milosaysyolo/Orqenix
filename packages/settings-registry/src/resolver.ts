// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Settings resolver
//
// Resolves a setting through the hierarchy: session → branch → project →
// user → system → built-in default. Per ADR-E-009 + INV-16.

import type {
  ModuleSettingsContract,
  ResolvedSetting,
  SettingsContext,
  SettingsLevel,
  HierarchyOverride,
} from './types';
import type { SettingsPersistence } from './persistence';

/** Resolution order from most specific to least specific */
const RESOLUTION_ORDER: Array<'session' | 'branch' | 'project' | 'user' | 'system'> = [
  'session',
  'branch',
  'project',
  'user',
  'system',
];

export class SettingsResolver {
  constructor(private readonly persistence: SettingsPersistence) {}

  /**
   * Resolves a setting through the hierarchy.
   *
   * Walks levels from session → system, returning the first explicit value
   * for which the module permits override. Falls back to built-in default.
   */
  async resolve(
    contract: ModuleSettingsContract,
    settingPath: string,
    context: SettingsContext
  ): Promise<ResolvedSetting> {
    for (const level of RESOLUTION_ORDER) {
      if (!this.canOverride(contract.hierarchyOverride, level)) {
        continue;
      }

      const hierarchyId = this.hierarchyIdForLevel(level, context);
      // session/branch/project require a hierarchyId; skip if absent
      if (
        (level === 'session' || level === 'branch' || level === 'project') &&
        hierarchyId === null
      ) {
        continue;
      }

      const override = await this.persistence.get(
        contract.moduleId,
        settingPath,
        level,
        hierarchyId
      );

      if (override !== undefined) {
        return {
          value: override.value,
          source: level,
          inherits: false,
          provenance: contract.provenance,
          hotReloadable: contract.hotReloadable,
        };
      }
    }

    // Fall back to built-in default
    const defaultValue = getByPath(contract.defaults, settingPath);
    return {
      value: defaultValue,
      source: 'built-in-default',
      inherits: true,
      provenance: contract.provenance,
      hotReloadable: contract.hotReloadable,
    };
  }

  /**
   * Returns the effective value only (convenience wrapper).
   */
  async resolveValue(
    contract: ModuleSettingsContract,
    settingPath: string,
    context: SettingsContext
  ): Promise<unknown> {
    return (await this.resolve(contract, settingPath, context)).value;
  }

  /** Whether a module permits override at a given level */
  private canOverride(
    override: HierarchyOverride,
    level: 'session' | 'branch' | 'project' | 'user' | 'system'
  ): boolean {
    switch (override) {
      case 'all':
        return true;
      case 'session':
        // session can override at session + everything below it
        return true;
      case 'branch':
        return level !== 'session';
      case 'project':
        return level === 'project' || level === 'user' || level === 'system';
      case 'none':
        return level === 'system';
    }
  }

  /** Maps a level to its hierarchy ID from context */
  private hierarchyIdForLevel(
    level: 'session' | 'branch' | 'project' | 'user' | 'system',
    context: SettingsContext
  ): string | null {
    switch (level) {
      case 'session':
        return context.sessionId ?? null;
      case 'branch':
        return context.branchId ?? null;
      case 'project':
        return context.projectId ?? null;
      case 'user':
        return context.userId ?? null;
      case 'system':
        return null; // system level has no hierarchy ID
    }
  }
}

/**
 * Gets a value from an object by dotted path (e.g., "hierarchy.level_boost.session").
 *
 * IMPORTANT (Bug 4, merge-verify): settings-bootstrap.ts declares defaults with
 * FLAT dotted keys: { 'hierarchy.level_boost.session': 1.5 }. Some callers use
 * NESTED objects: { hierarchy: { level_boost: { session: 1.5 } } }. This function
 * supports BOTH — it checks the flat key first, then falls back to nested traversal.
 */
export function getByPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  // 1. Flat key match first (settings-bootstrap convention)
  if (Object.prototype.hasOwnProperty.call(obj, path)) {
    return obj[path];
  }

  // 2. Nested traversal fallback
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
