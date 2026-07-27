// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Plugin lifecycle orchestrator
//
// Coordinates the 5-phase lifecycle: install → configure → activate →
// deactivate → uninstall. Per CR v8.0 Section 7.3.

import type { PluginDiscoveryResult, RegisteredPlugin } from './types';
import { PluginRegistry } from './plugin-registry';
import { PluginLoader } from './plugin-loader';
import { PluginKindRegistry } from './kinds/registry';
import type { PluginAuditWriter } from './audit-kinds';
import { NoopPluginAuditWriter } from './audit-kinds';
import {
  PluginInstallFailedError,
  PluginActivateFailedError,
} from './errors';

export interface PluginLifecycleOptions {
  registry?: PluginRegistry;
  loader?: PluginLoader;
  kindRegistry?: PluginKindRegistry;
  auditWriter?: PluginAuditWriter;
  /** Actor recorded in audit (default: 'system') */
  actor?: string;
}

/**
 * Orchestrates plugin lifecycle transitions with audit + kind-specific hooks.
 */
export class PluginLifecycle {
  private readonly registry: PluginRegistry;
  private readonly loader: PluginLoader;
  private readonly kindRegistry: PluginKindRegistry;
  private readonly audit: PluginAuditWriter;
  private readonly actor: string;

  constructor(options: PluginLifecycleOptions = {}) {
    this.kindRegistry = options.kindRegistry ?? new PluginKindRegistry();
    this.registry = options.registry ?? new PluginRegistry();
    this.loader = options.loader ?? new PluginLoader({ kindRegistry: this.kindRegistry });
    this.audit = options.auditWriter ?? new NoopPluginAuditWriter();
    this.actor = options.actor ?? "system";
  }

  /**
   * Phase 1: Install
   * Loads + validates + registers a plugin, runs kind-specific onInstall hook.
   */
  async install(packagePath: string): Promise<RegisteredPlugin> {
    let discovery: PluginDiscoveryResult;
    try {
      discovery = await this.loader.load(packagePath);
    } catch (err) {
      await this.auditEvent("plugin.install_failed", {
        packagePath,
        error: (err as Error).message,
      });
      throw new PluginInstallFailedError(packagePath, (err as Error).message, err);
    }

    if (!discovery.isValidPlugin) {
      await this.auditEvent("plugin.install_failed", {
        packagePath,
        issues: discovery.issues,
      });
      throw new PluginInstallFailedError(
        packagePath,
        `Manifest invalid: ${discovery.issues.join("; ")}`,
      );
    }

    await this.auditEvent("plugin.manifest_validated", {
      name: discovery.csf.name,
      version: discovery.csf.version,
      kind: discovery.csf.kind,
      contentHash: discovery.csf.provenance.contentHash,
    });

    // Run kind-specific onInstall hook
    const handler = this.kindRegistry.getHandler(discovery.csf.kind);
    if (handler.onInstall) {
      try {
        await handler.onInstall(discovery.csf, discovery.packagePath);
      } catch (err) {
        await this.auditEvent("plugin.install_failed", {
          name: discovery.csf.name,
          error: (err as Error).message,
        });
        throw new PluginInstallFailedError(
          discovery.csf.name,
          `onInstall hook failed: ${(err as Error).message}`,
          err,
        );
      }
    }

    // Register
    const entry = await this.registry.register(discovery);

    await this.auditEvent("plugin.installed", {
      name: entry.csf.name,
      version: entry.csf.version,
      kind: entry.csf.kind,
    });

    return entry;
  }

  /**
   * Phase 2: Configure
   * Marks a plugin as configured after user reviews settings.
   */
  async configure(name: string): Promise<void> {
    await this.registry.setState(name, "configured");
    const entry = this.registry.get(name);
    await this.auditEvent("plugin.configured", {
      name: entry.csf.name,
      version: entry.csf.version,
    });
  }

  /**
   * Phase 3: Activate
   * Runs kind-specific onActivate hook, transitions to 'active'.
   * NOTE: sandbox spawning happens in SandboxManager (Part 4); this orchestrates
   * the state transition + hooks.
   */
  async activate(name: string): Promise<RegisteredPlugin> {
    const entry = this.registry.get(name);
    const handler = this.kindRegistry.getHandler(entry.csf.kind);

    if (handler.onActivate) {
      try {
        await handler.onActivate(entry.csf);
      } catch (err) {
        await this.auditEvent("plugin.activate_failed", {
          name: entry.csf.name,
          error: (err as Error).message,
        });
        throw new PluginActivateFailedError(
          entry.csf.name,
          `onActivate hook failed: ${(err as Error).message}`,
          err,
        );
      }
    }

    await this.registry.setState(name, "active");
    await this.auditEvent("plugin.activated", {
      name: entry.csf.name,
      version: entry.csf.version,
    });

    return this.registry.get(name);
  }

  /**
   * Phase 4: Deactivate
   * Runs kind-specific onDeactivate hook, transitions to 'inactive'.
   */
  async deactivate(name: string): Promise<void> {
    const entry = this.registry.get(name);
    const handler = this.kindRegistry.getHandler(entry.csf.kind);

    if (handler.onDeactivate) {
      try {
        await handler.onDeactivate(entry.csf);
      } catch (err) {
        // Deactivate failures are logged but don't block transition
        await this.auditEvent("plugin.deactivated", {
          name: entry.csf.name,
          warning: `onDeactivate hook error: ${(err as Error).message}`,
        });
      }
    }

    await this.registry.setState(name, "inactive");
    await this.auditEvent("plugin.deactivated", {
      name: entry.csf.name,
      version: entry.csf.version,
    });
  }

  /**
   * Phase 5: Uninstall
   * Deactivates if active, removes from registry, retains audit history.
   */
  async uninstall(name: string): Promise<void> {
    const entry = this.registry.find(name);
    if (!entry) return; // idempotent

    if (entry.state === "active") {
      await this.deactivate(name);
    }

    await this.registry.unregister(name);
    await this.auditEvent("plugin.uninstalled", {
      name: entry.csf.name,
      version: entry.csf.version,
    });
  }

  /**
   * Update a plugin to a new version (loads new package, replaces in registry).
   */
  async update(name: string, newPackagePath: string): Promise<RegisteredPlugin> {
    const oldEntry = this.registry.get(name);
    const wasActive = oldEntry.state === "active";

    if (wasActive) {
      await this.deactivate(name);
    }

    const discovery = await this.loader.load(newPackagePath);
    if (!discovery.isValidPlugin) {
      throw new PluginInstallFailedError(
        name,
        `Update manifest invalid: ${discovery.issues.join("; ")}`,
      );
    }

    const oldVersion = oldEntry.csf.version;
    const updated = await this.registry.update(name, discovery.csf, discovery.packagePath);

    await this.auditEvent("plugin.updated", {
      name,
      oldVersion,
      newVersion: discovery.csf.version,
    });

    if (wasActive) {
      await this.activate(name);
    }

    return updated;
  }

  /** Returns the underlying registry */
  getRegistry(): PluginRegistry {
    return this.registry;
  }

  private async auditEvent(
    kind: Parameters<PluginAuditWriter["append"]>[0]["kind"],
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.append({
      kind,
      ts: new Date().toISOString(),
      actor: { user: this.actor },
      payload,
    });
  }
}
