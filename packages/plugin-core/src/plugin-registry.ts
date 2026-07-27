// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Plugin registry
//
// In-memory registry of installed plugins with optional persistence.
// Tracks lifecycle state, crash counts, invocation stats.

import type { CanonicalSkillFormat } from './csf-schema';
import type {
  RegisteredPlugin,
  PluginLifecycleState,
  PluginDiscoveryResult,
} from './types';
import type { PluginRegistryInterface } from './registry-interface';
import {
  PluginAlreadyRegisteredError,
  PluginNotRegisteredError,
} from './errors';

/**
 * Interface for persisting registry state (provided by D8.α.6 Memory Engine
 * which writes to .orqenix/marketplace.sqlite installed_plugins table).
 */
export interface RegistryPersistence {
  load(): Promise<RegisteredPlugin[]>;
  save(plugins: RegisteredPlugin[]): Promise<void>;
}

/**
 * No-op persistence for tests / standalone usage.
 */
export class InMemoryRegistryPersistence implements RegistryPersistence {
  private stored: RegisteredPlugin[] = [];

  async load(): Promise<RegisteredPlugin[]> {
    return [...this.stored];
  }

  async save(plugins: RegisteredPlugin[]): Promise<void> {
    this.stored = [...plugins];
  }
}

/**
 * Registry of installed plugins.
 */
export class PluginRegistry implements PluginRegistryInterface { // eslint-disable-line @typescript-eslint/no-unused-vars
  private plugins: Map<string, RegisteredPlugin> = new Map();
  private readonly persistence: RegistryPersistence;

  constructor(persistence?: RegistryPersistence) {
    this.persistence = persistence ?? new InMemoryRegistryPersistence();
  }

  /** Loads registry state from persistence */
  async init(): Promise<void> {
    const loaded = await this.persistence.load();
    this.plugins.clear();
    for (const p of loaded) {
      this.plugins.set(p.csf.name, p);
    }
  }

  /** Registers a newly discovered plugin (transitions to 'installed' state) */
  async register(discovery: PluginDiscoveryResult): Promise<RegisteredPlugin> {
    if (!discovery.isValidPlugin) {
      throw new PluginNotRegisteredError(
        `Cannot register invalid plugin: ${discovery.issues.join("; ")}`,
      );
    }

    const name = discovery.csf.name;
    if (this.plugins.has(name)) {
      throw new PluginAlreadyRegisteredError(name);
    }

    const entry: RegisteredPlugin = {
      csf: discovery.csf,
      packagePath: discovery.packagePath,
      state: "installed",
      installedAt: new Date().toISOString(),
      lastActivatedAt: null,
      crashCount: 0,
      totalInvocations: 0,
      totalErrors: 0,
    };

    this.plugins.set(name, entry);
    await this.flush();
    return entry;
  }

  /** Transitions a plugin to a new lifecycle state */
  async setState(name: string, state: PluginLifecycleState): Promise<void> {
    const entry = this.get(name);
    entry.state = state;
    if (state === "active") {
      entry.lastActivatedAt = new Date().toISOString();
      entry.crashCount = 0; // reset on successful activation
    }
    await this.flush();
  }

  /** Records a plugin crash (increments crash count, sets state) */
  async recordCrash(name: string): Promise<number> {
    const entry = this.get(name);
    entry.crashCount += 1;
    entry.state = "crashed";
    await this.flush();
    return entry.crashCount;
  }

  /** Records a successful invocation */
  async recordInvocation(name: string, success: boolean): Promise<void> {
    const entry = this.get(name);
    if (success) {
      entry.totalInvocations += 1;
    } else {
      entry.totalErrors += 1;
    }
    // Don't flush on every invocation (perf); persistence layer batches
  }

  /** Updates a plugin to a new version (in-place) */
  async update(
    name: string,
    newCsf: CanonicalSkillFormat,
    newPackagePath: string,
  ): Promise<RegisteredPlugin> {
    const entry = this.get(name);
    entry.csf = newCsf;
    entry.packagePath = newPackagePath;
    entry.state = "installed"; // re-configure + re-activate needed after update
    await this.flush();
    return entry;
  }

  /** Unregisters a plugin (removes from registry) */
  async unregister(name: string): Promise<void> {
    if (!this.plugins.has(name)) {
      throw new PluginNotRegisteredError(name);
    }
    this.plugins.delete(name);
    await this.flush();
  }

  /** Gets a registered plugin, throws if not found */
  get(name: string): RegisteredPlugin {
    const entry = this.plugins.get(name);
    if (!entry) {
      throw new PluginNotRegisteredError(name);
    }
    return entry;
  }

  /** Returns a registered plugin or null */
  find(name: string): RegisteredPlugin | null {
    return this.plugins.get(name) ?? null;
  }

  /** Lists all registered plugins */
  list(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Lists plugins in a given state */
  listByState(state: PluginLifecycleState): RegisteredPlugin[] {
    return this.list().filter((p) => p.state === state);
  }

  /** Lists plugins of a given kind */
  listByKind(kind: string): RegisteredPlugin[] {
    return this.list().filter((p) => p.csf.kind === kind);
  }

  /** Returns count of registered plugins */
  count(): number {
    return this.plugins.size;
  }

  /** Checks if a plugin is registered */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** Flushes registry state to persistence */
  async flush(): Promise<void> {
    await this.persistence.save(this.list());
  }
}
