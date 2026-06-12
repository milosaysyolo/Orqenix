// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Type definitions

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Hierarchy levels (per ADR-E-009)
// ─────────────────────────────────────────────────────────────────────────

export type SettingsLevel =
  | 'session'
  | 'branch'
  | 'project'
  | 'user'
  | 'system'
  | 'built-in-default';

/** Override scope a module permits */
export type HierarchyOverride =
  | 'session' // can override at session level and below
  | 'branch' // branch + project + user + system
  | 'project' // project + user + system
  | 'all' // every level
  | 'none'; // only system can override

// ─────────────────────────────────────────────────────────────────────────
// Provenance (which phase locked a default, per G64-10)
// ─────────────────────────────────────────────────────────────────────────

export const SettingsProvenanceSchema = z.object({
  /** Phase that locked this default (2 | 3 | 4 | 6 | 7 | 8) */
  phase: z.number().int().min(1).max(10),
  /** CR version (e.g., 'v8.0') */
  crVersion: z.string(),
  /** Human-readable rationale */
  rationale: z.string(),
});

export type SettingsProvenance = z.infer<typeof SettingsProvenanceSchema>;

// ─────────────────────────────────────────────────────────────────────────
// UI hints for Workbench rendering
// ─────────────────────────────────────────────────────────────────────────

export interface SettingsUiHints {
  category?:
    | 'memory'
    | 'storage'
    | 'search'
    | 'mesh'
    | 'cloud-sync'
    | 'self-learning'
    | 'plugins';
  section?: 'basic' | 'advanced';
  displayName?: string;
  description?: string;
  helpUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Hot reload handler
// ─────────────────────────────────────────────────────────────────────────

export type HotReloadHandler = (
  newValue: unknown,
  oldValue: unknown,
  settingPath: string
) => Promise<void> | void;

// ─────────────────────────────────────────────────────────────────────────
// Validation result
// ─────────────────────────────────────────────────────────────────────────

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}

export type SettingsValidator = (value: unknown) => SettingsValidationResult;

// ─────────────────────────────────────────────────────────────────────────
// Module settings contract (the core registration shape)
// ─────────────────────────────────────────────────────────────────────────

export interface ModuleSettingsContract {
  /** Module identifier (e.g., '@orqenix/memory-engine') */
  moduleId: string;
  /** Module version */
  version: string;
  /** JSON Schema for validation */
  settingsSchema: Record<string, unknown>;
  /** Default values keyed by dotted setting path */
  defaults: Record<string, unknown>;
  /** Provenance: where these defaults were locked */
  provenance: SettingsProvenance;
  /** Whether settings can be hot-reloaded */
  hotReloadable: boolean;
  /** Hot reload handler (called on change if hotReloadable) */
  hotReloadHandler?: HotReloadHandler;
  /** Which hierarchy levels can override */
  hierarchyOverride: HierarchyOverride;
  /** Optional UI rendering hints */
  uiHints?: Record<string, SettingsUiHints>;
  /** Optional per-setting validator (beyond JSON schema) */
  validate?: SettingsValidator;
}

// ─────────────────────────────────────────────────────────────────────────
// Setting context (which hierarchy node we resolve for)
// ─────────────────────────────────────────────────────────────────────────

export interface SettingsContext {
  sessionId?: string;
  branchId?: string;
  projectId?: string;
  /** User identifier (for user-level settings + audit) */
  userId?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Resolved setting
// ─────────────────────────────────────────────────────────────────────────

export interface ResolvedSetting {
  /** Effective value */
  value: unknown;
  /** Which level provided the value */
  source: SettingsLevel;
  /** Whether the value is inherited from built-in default */
  inherits: boolean;
  /** Provenance of the default (always present for badge display) */
  provenance: SettingsProvenance;
  /** The module's hot-reloadable flag */
  hotReloadable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Setting override (a stored per-level value)
// ─────────────────────────────────────────────────────────────────────────

export const SettingsOverrideSchema = z.object({
  moduleId: z.string(),
  settingPath: z.string(),
  level: z.enum(['session', 'branch', 'project', 'user', 'system']),
  /** session_id, branch_id, or project_id (null for user/system) */
  hierarchyId: z.string().nullable(),
  value: z.unknown(),
  setAt: z.string().datetime(),
  setBy: z.string(),
});

export type SettingsOverride = z.infer<typeof SettingsOverrideSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Update request
// ─────────────────────────────────────────────────────────────────────────

export interface UpdateSettingInput {
  level: 'session' | 'branch' | 'project' | 'user' | 'system';
  /** Required for session/branch/project levels */
  hierarchyId?: string;
  /** Who is making the change (for audit) */
  setBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Audit event
// ─────────────────────────────────────────────────────────────────────────

export type SettingsAuditKind =
  | 'settings.changed'
  | 'settings.hot_reload_failed'
  | 'settings.imported'
  | 'settings.exported'
  | 'settings.module_registered';

export interface SettingsAuditEvent {
  kind: SettingsAuditKind;
  ts: string;
  actor: { user: string };
  payload: Record<string, unknown>;
}

export interface SettingsAuditWriter {
  append(event: SettingsAuditEvent): Promise<void>;
}

export class NoopSettingsAuditWriter implements SettingsAuditWriter {
  async append(): Promise<void> {
    // no-op
  }
}

export class InMemorySettingsAuditWriter implements SettingsAuditWriter {
  private events: SettingsAuditEvent[] = [];
  async append(event: SettingsAuditEvent): Promise<void> {
    this.events.push(event);
  }
  getEvents(): readonly SettingsAuditEvent[] {
    return [...this.events];
  }
  clear(): void {
    this.events.length = 0;
  }
}
