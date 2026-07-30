// SPDX-License-Identifier: Apache-2.0
// @orqenix/settings-registry , Settings registry (top-level orchestrator)
//
// Coordinates module registration, resolution, updates with hot-reload, and
// audit. Per CR v8.0 Chapter 10 + ADR-E-009 + Anti-pattern 37.

import type {
  ModuleSettingsContract,
  ResolvedSetting,
  SettingsContext,
  SettingsOverride,
  UpdateSettingInput,
  SettingsAuditWriter,
} from "./types";
import { NoopSettingsAuditWriter } from "./types";
import { SettingsResolver, getByPath } from "./resolver";
import { type SettingsPersistence, InMemorySettingsPersistence } from "./persistence";

export interface SettingsRegistryOptions {
  persistence?: SettingsPersistence;
  auditWriter?: SettingsAuditWriter;
  /** Default actor for audit when not specified per-update */
  defaultActor?: string;
}

/** A watch subscriber notified on setting changes */
type WatchCallback = (newValue: unknown, oldValue: unknown) => void;

export class SettingsRegistry {
  private contracts: Map<string, ModuleSettingsContract> = new Map();
  private readonly resolver: SettingsResolver;
  private readonly persistence: SettingsPersistence;
  private readonly audit: SettingsAuditWriter;
  private readonly defaultActor: string;

  /** key = `${moduleId}::${settingPath}` → watchers */
  private watchers: Map<string, WatchCallback[]> = new Map();

  constructor(options: SettingsRegistryOptions = {}) {
    this.persistence = options.persistence ?? new InMemorySettingsPersistence();
    this.audit = options.auditWriter ?? new NoopSettingsAuditWriter();
    this.defaultActor = options.defaultActor ?? "system";
    this.resolver = new SettingsResolver(this.persistence);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Registration (Anti-pattern 37: modules MUST register here)
  // ─────────────────────────────────────────────────────────────────────

  /** Registers a module's settings contract */
  async register(contract: ModuleSettingsContract): Promise<void> {
    this.contracts.set(contract.moduleId, contract);
    await this.audit.append({
      kind: "settings.module_registered",
      ts: new Date().toISOString(),
      actor: { user: this.defaultActor },
      payload: {
        moduleId: contract.moduleId,
        version: contract.version,
        phase: contract.provenance.phase,
        settingsCount: Object.keys(contract.defaults).length,
        hotReloadable: contract.hotReloadable,
        hierarchyOverride: contract.hierarchyOverride,
      },
    });
  }

  /** Unregisters a module (e.g., on plugin uninstall) */
  unregister(moduleId: string): void {
    this.contracts.delete(moduleId);
  }

  /** Returns a contract or throws */
  getContract(moduleId: string): ModuleSettingsContract {
    const contract = this.contracts.get(moduleId);
    if (!contract) {
      throw new Error(
        `Module '${moduleId}' is not registered with Settings Registry. ` +
          `Modules MUST register via register() per Anti-pattern 37.`,
      );
    }
    return contract;
  }

  /** Lists all registered module contracts */
  listContracts(): ModuleSettingsContract[] {
    return Array.from(this.contracts.values());
  }

  /** Returns count of registered modules */
  count(): number {
    return this.contracts.size;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Resolution
  // ─────────────────────────────────────────────────────────────────────

  /** Resolves a setting through the hierarchy */
  async resolve(
    moduleId: string,
    settingPath: string,
    context: SettingsContext = {},
  ): Promise<ResolvedSetting> {
    const contract = this.getContract(moduleId);
    return this.resolver.resolve(contract, settingPath, context);
  }

  /** Resolves the effective value only */
  async resolveValue(
    moduleId: string,
    settingPath: string,
    context: SettingsContext = {},
  ): Promise<unknown> {
    return (await this.resolve(moduleId, settingPath, context)).value;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Updates (with hot reload + audit + rollback)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Updates a setting at a given level. Fires hot-reload handler within 100ms
   * if the module is hotReloadable. Rolls back on hot-reload failure.
   */
  async update(
    moduleId: string,
    settingPath: string,
    newValue: unknown,
    input: UpdateSettingInput,
  ): Promise<void> {
    const contract = this.getContract(moduleId);

    // Validate the new value (JSON schema check is caller responsibility;
    // we run the optional module validator if provided)
    if (contract.validate) {
      const result = contract.validate(newValue);
      if (!result.valid) {
        throw new Error(
          `Setting validation failed for ${moduleId}.${settingPath}: ${result.errors.join("; ")}`,
        );
      }
    }

    // Validate override level is permitted
    const hierarchyId = this.resolveHierarchyId(input);
    const oldOverride = await this.persistence.get(moduleId, settingPath, input.level, hierarchyId);
    const oldValue = oldOverride?.value ?? getByPath(contract.defaults, settingPath);

    // Persist
    const override: SettingsOverride = {
      moduleId,
      settingPath,
      level: input.level,
      hierarchyId,
      value: newValue,
      setAt: new Date().toISOString(),
      setBy: input.setBy ?? this.defaultActor,
    };
    await this.persistence.set(override);

    // Audit
    await this.audit.append({
      kind: "settings.changed",
      ts: new Date().toISOString(),
      actor: { user: input.setBy ?? this.defaultActor },
      payload: {
        moduleId,
        settingPath,
        oldValue,
        newValue,
        level: input.level,
        hierarchyId,
      },
    });

    // Hot reload (within 100ms target per G64-04)
    if (contract.hotReloadable && contract.hotReloadHandler) {
      try {
        await contract.hotReloadHandler(newValue, oldValue, settingPath);
      } catch (err) {
        // Rollback on hot-reload failure (G64-05)
        if (oldOverride) {
          await this.persistence.set(oldOverride);
        } else {
          await this.persistence.delete(moduleId, settingPath, input.level, hierarchyId);
        }
        await this.audit.append({
          kind: "settings.hot_reload_failed",
          ts: new Date().toISOString(),
          actor: { user: input.setBy ?? this.defaultActor },
          payload: {
            moduleId,
            settingPath,
            error: (err as Error).message,
            rolledBack: true,
          },
        });
        throw err;
      }
    }

    // Notify watchers
    this.notifyWatchers(moduleId, settingPath, newValue, oldValue);
  }

  /** Removes an override (reverts to fallback) */
  async revert(moduleId: string, settingPath: string, input: UpdateSettingInput): Promise<void> {
    const hierarchyId = this.resolveHierarchyId(input);
    await this.persistence.delete(moduleId, settingPath, input.level, hierarchyId);
    await this.audit.append({
      kind: "settings.changed",
      ts: new Date().toISOString(),
      actor: { user: input.setBy ?? this.defaultActor },
      payload: {
        moduleId,
        settingPath,
        level: input.level,
        hierarchyId,
        reverted: true,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Watch (subscribers notified on change)
  // ─────────────────────────────────────────────────────────────────────

  /** Subscribes to changes on a setting. Returns an unsubscribe function. */
  watch(moduleId: string, settingPath: string, callback: WatchCallback): () => void {
    const key = `${moduleId}::${settingPath}`;
    const callbacks = this.watchers.get(key) ?? [];
    callbacks.push(callback);
    this.watchers.set(key, callbacks);
    return () => {
      const remaining = (this.watchers.get(key) ?? []).filter((c) => c !== callback);
      this.watchers.set(key, remaining);
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Accessors for export/import + persistence
  // ─────────────────────────────────────────────────────────────────────

  getPersistence(): SettingsPersistence {
    return this.persistence;
  }

  getAuditWriter(): SettingsAuditWriter {
    return this.audit;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────

  private resolveHierarchyId(input: UpdateSettingInput): string | null {
    if (
      input.level === "session" ||
      input.level === "branch" ||
      input.level === "project" ||
      input.level === "user"
    ) {
      if (!input.hierarchyId) {
        throw new Error(`Setting override at level '${input.level}' requires hierarchyId`);
      }
      return input.hierarchyId;
    }
    return null; // system
  }

  private notifyWatchers(
    moduleId: string,
    settingPath: string,
    newValue: unknown,
    oldValue: unknown,
  ): void {
    const key = `${moduleId}::${settingPath}`;
    const callbacks = this.watchers.get(key) ?? [];
    for (const cb of callbacks) {
      try {
        cb(newValue, oldValue);
      } catch {
        // watcher errors isolated
      }
    }
  }
}
