// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Persistence layer
//
// Stores per-level setting overrides. Default implementation is in-memory;
// D8.α.6 wires SQLite-backed persistence (.orqenix config_overrides table,
// Migration 560).

import type { SettingsOverride } from './types';

/**
 * Interface for persisting setting overrides.
 */
export interface SettingsPersistence {
  /** Reads a single override; returns undefined if not set */
  get(
    moduleId: string,
    settingPath: string,
    level: "session" | "branch" | "project" | "user" | "system",
    hierarchyId: string | null,
  ): Promise<SettingsOverride | undefined>;

  /** Writes an override */
  set(override: SettingsOverride): Promise<void>;

  /** Deletes an override (reverts to fallback) */
  delete(
    moduleId: string,
    settingPath: string,
    level: "session" | "branch" | "project" | "user" | "system",
    hierarchyId: string | null,
  ): Promise<void>;

  /** Lists all overrides (for export) */
  list(): Promise<SettingsOverride[]>;

  /** Lists overrides for a specific module */
  listByModule(moduleId: string): Promise<SettingsOverride[]>;
}

/**
 * In-memory persistence. Used standalone + tests.
 * D8.α.6 substitutes SQLite-backed implementation.
 */
export class InMemorySettingsPersistence implements SettingsPersistence {
  private overrides: Map<string, SettingsOverride> = new Map();

  async get(
    moduleId: string,
    settingPath: string,
    level: "session" | "branch" | "project" | "user" | "system",
    hierarchyId: string | null,
  ): Promise<SettingsOverride | undefined> {
    return this.overrides.get(this.key(moduleId, settingPath, level, hierarchyId));
  }

  async set(override: SettingsOverride): Promise<void> {
    this.overrides.set(
      this.key(override.moduleId, override.settingPath, override.level, override.hierarchyId),
      override,
    );
  }

  async delete(
    moduleId: string,
    settingPath: string,
    level: "session" | "branch" | "project" | "user" | "system",
    hierarchyId: string | null,
  ): Promise<void> {
    this.overrides.delete(this.key(moduleId, settingPath, level, hierarchyId));
  }

  async list(): Promise<SettingsOverride[]> {
    return Array.from(this.overrides.values());
  }

  async listByModule(moduleId: string): Promise<SettingsOverride[]> {
    return Array.from(this.overrides.values()).filter((o) => o.moduleId === moduleId);
  }

  /** Clears all overrides (for tests) */
  clear(): void {
    this.overrides.clear();
  }

  private key(
    moduleId: string,
    settingPath: string,
    level: string,
    hierarchyId: string | null,
  ): string {
    return `${moduleId}::${settingPath}::${level}::${hierarchyId ?? "_"}`;
  }
}
