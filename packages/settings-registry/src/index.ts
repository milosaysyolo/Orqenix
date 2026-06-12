// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Public API surface
//
// Phase 8 Foundation (D8.α.5)
// Charter gate: G64 (Settings Registry + Hot Reload + Hierarchy Override)

// ─────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────

export { SettingsRegistry } from './registry';
export type { SettingsRegistryOptions } from './registry';

export { SettingsResolver, getByPath } from './resolver';

export {
  type SettingsPersistence,
  InMemorySettingsPersistence,
} from './persistence';

// ─────────────────────────────────────────────────────────────────────────
// Export / Import (Part 2)
// ─────────────────────────────────────────────────────────────────────────

export {
  exportSettings,
  importSettings,
} from './export-import';
export type {
  ExportOptions,
  ImportOptions,
  ExportedSettings,
} from './export-import';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type {
  SettingsLevel,
  HierarchyOverride,
  SettingsProvenance,
  SettingsUiHints,
  HotReloadHandler,
  SettingsValidationResult,
  SettingsValidator,
  ModuleSettingsContract,
  SettingsContext,
  ResolvedSetting,
  SettingsOverride,
  UpdateSettingInput,
  SettingsAuditKind,
  SettingsAuditEvent,
  SettingsAuditWriter,
} from './types';

export {
  SettingsProvenanceSchema,
  SettingsOverrideSchema,
  NoopSettingsAuditWriter,
  InMemorySettingsAuditWriter,
} from './types';
