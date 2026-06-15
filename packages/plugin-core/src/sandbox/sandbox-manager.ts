// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Sandbox manager
//
// Top-level orchestrator for plugin sandboxes. Spawns / tracks / invokes /
// terminates plugin processes. Coordinates crash handling + resource limits.
//
// Per CR v8.0 INV-14 + ADR-E-004.

import type { CanonicalSkillFormat } from '../csf-schema';
import type {
  PluginInvocationRequest,
  PluginInvocationResult,
  PluginRuntimeHandle,
  RegisteredPlugin,
} from '../types';
import { ProcessSandbox } from './process-sandbox';
import { CrashHandler } from './crash-handler';
import {
  resolveResourceLimits,
  type ResolvedResourceLimits,
} from './resource-limits';
import type { PluginAuditWriter } from '../audit-kinds';
import { NoopPluginAuditWriter } from '../audit-kinds';
import {
  PluginActivateFailedError,
  PluginNotRegisteredError,
} from '../errors';

export interface SandboxManagerOptions {
  auditWriter?: PluginAuditWriter;
  /** Operator-level resource limit defaults (act as ceiling) */
  operatorLimits?: Partial<ResolvedResourceLimits>;
  /** Max crashes before auto-disable (default 3) */
  maxCrashesBeforeDisable?: number;
  /** Callback when a plugin is auto-disabled */
  onAutoDisable?: (pluginName: string, crashCount: number) => void;
}

/**
 * Manages the lifecycle of plugin sandboxes (separate processes).
 *
 * Each active plugin has exactly one ProcessSandbox. The manager:
 *   - Spawns sandboxes on activate
 *   - Routes invocations to the right sandbox
 *   - Handles crashes (auto-disable after repeated failures)
 *   - Terminates sandboxes on deactivate
 */
export class SandboxManager {
  private readonly audit: PluginAuditWriter;
  private readonly operatorLimits: Partial<ResolvedResourceLimits>;
  private readonly crashHandler: CrashHandler;

  /** Map of pluginName → active ProcessSandbox */
  private sandboxes: Map<string, ProcessSandbox> = new Map();

  constructor(options: SandboxManagerOptions = {}) {
    this.audit = options.auditWriter ?? new NoopPluginAuditWriter();
    this.operatorLimits = options.operatorLimits ?? {};
    this.crashHandler = new CrashHandler({
      auditWriter: this.audit,
      ...(options.maxCrashesBeforeDisable !== undefined
        ? { maxCrashesBeforeDisable: options.maxCrashesBeforeDisable }
        : {}),
      onAutoDisable: (name, count) => {
        // Clean up the dead sandbox reference
        this.sandboxes.delete(name);
        if (options.onAutoDisable) {
          options.onAutoDisable(name, count);
        }
      },
    });
  }

  /**
   * Activates a plugin by spawning its sandbox.
   *
   * @param plugin Registered plugin to activate
   * @param entryPath Resolved entry path (from loader)
   */
  async activate(
    plugin: RegisteredPlugin,
    entryPath: string
  ): Promise<PluginRuntimeHandle> {
    const name = plugin.csf.name;

    if (this.sandboxes.has(name)) {
      // Already active; return existing handle
      return this.sandboxes.get(name)!;
    }

    const limits = resolveResourceLimits(
      plugin.csf.manifest.sandboxOverrides,
      this.operatorLimits
    );

    const sandbox = new ProcessSandbox({
      csf: plugin.csf,
      entryPath,
      limits,
      onCrash: (event) => {
        void this.crashHandler.handleCrash({
          pluginName: name,
          pluginVersion: plugin.csf.version,
          exitCode: event.exitCode,
          signal: event.signal,
          stderr: event.stderr,
          uptimeMs: event.uptimeMs,
          timestamp: new Date().toISOString(),
        });
      },
    });

    try {
      await sandbox.spawn();
    } catch (err) {
      await this.audit.append({
        kind: 'plugin.activate_failed',
        ts: new Date().toISOString(),
        actor: { system: 'sandbox-manager' },
        payload: { name, error: (err as Error).message },
      });
      throw err instanceof PluginActivateFailedError
        ? err
        : new PluginActivateFailedError(name, (err as Error).message, err);
    }

    this.sandboxes.set(name, sandbox);
    this.crashHandler.reset(name);

    await this.audit.append({
      kind: 'plugin.activated',
      ts: new Date().toISOString(),
      actor: { system: 'sandbox-manager' },
      payload: { name, version: plugin.csf.version, pid: sandbox.pid },
    });

    return sandbox;
  }

  /**
   * Invokes a tool on an active plugin.
   */
  async invoke(
    request: PluginInvocationRequest
  ): Promise<PluginInvocationResult> {
    const sandbox = this.sandboxes.get(request.pluginName);
    if (!sandbox) {
      throw new PluginNotRegisteredError(
        `${request.pluginName} is not active. Activate it first.`
      );
    }

    const startMs = Date.now();
    try {
      const result = await sandbox.invoke(request);
      await this.audit.append({
        kind: 'plugin.invocation',
        ts: new Date().toISOString(),
        actor: { system: 'sandbox-manager' },
        payload: {
          name: request.pluginName,
          toolName: request.toolName,
          durationMs: result.durationMs,
          inputHash: result.inputHash,
          outputHash: result.outputHash,
          ...(request.traceId ? { traceId: request.traceId } : {}),
        },
      });
      return result;
    } catch (err) {
      await this.audit.append({
        kind: 'plugin.invocation_failed',
        ts: new Date().toISOString(),
        actor: { system: 'sandbox-manager' },
        payload: {
          name: request.pluginName,
          toolName: request.toolName,
          durationMs: Date.now() - startMs,
          error: (err as Error).message,
        },
      });
      throw err;
    }
  }

  /**
   * Deactivates a plugin by terminating its sandbox.
   */
  async deactivate(pluginName: string): Promise<void> {
    const sandbox = this.sandboxes.get(pluginName);
    if (!sandbox) return; // idempotent

    await sandbox.terminate();
    this.sandboxes.delete(pluginName);

    await this.audit.append({
      kind: 'plugin.deactivated',
      ts: new Date().toISOString(),
      actor: { system: 'sandbox-manager' },
      payload: { name: pluginName },
    });
  }

  /** Returns whether a plugin is currently active */
  isActive(pluginName: string): boolean {
    return this.sandboxes.has(pluginName);
  }

  /** Returns the active sandbox handle for a plugin, or null */
  getHandle(pluginName: string): PluginRuntimeHandle | null {
    return this.sandboxes.get(pluginName) ?? null;
  }

  /** Returns names of all active plugins */
  listActive(): string[] {
    return Array.from(this.sandboxes.keys());
  }

  /** Returns the crash count for a plugin within the current window */
  getCrashCount(pluginName: string): number {
    return this.crashHandler.getCrashCount(pluginName);
  }

  /** Terminates all sandboxes (e.g., on Workbench shutdown) */
  async terminateAll(): Promise<void> {
    const names = Array.from(this.sandboxes.keys());
    await Promise.allSettled(names.map((name) => this.deactivate(name)));
  }
}
