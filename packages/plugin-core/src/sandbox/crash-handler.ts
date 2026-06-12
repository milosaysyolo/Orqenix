// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Crash handler
//
// Detects + handles plugin sandbox crashes WITHOUT affecting Workbench or
// other plugins. Per CR v8.0 INV-14.

import type { PluginAuditWriter } from '../audit-kinds';
import { NoopPluginAuditWriter } from '../audit-kinds';

export interface CrashEvent {
  pluginName: string;
  pluginVersion: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  uptimeMs: number;
  timestamp: string;
}

export interface CrashHandlerOptions {
  auditWriter?: PluginAuditWriter;
  /** Max crashes before auto-disable (default 3) */
  maxCrashesBeforeDisable?: number;
  /** Time window for crash counting in ms (default 5 min) */
  crashWindowMs?: number;
  /** Callback when a plugin is auto-disabled due to repeated crashes */
  onAutoDisable?: (pluginName: string, crashCount: number) => void;
}

/**
 * Tracks plugin crashes and decides when to auto-disable a misbehaving plugin.
 *
 * Per INV-14: a crashed plugin's process exit is contained at the sandbox
 * boundary; the host process catches the exit and never propagates it.
 */
export class CrashHandler {
  private readonly audit: PluginAuditWriter;
  private readonly maxCrashes: number;
  private readonly windowMs: number;
  private readonly onAutoDisable:
    | ((pluginName: string, crashCount: number) => void)
    | undefined;

  /** Map of pluginName → array of crash timestamps within the window */
  private crashTimes: Map<string, number[]> = new Map();

  constructor(options: CrashHandlerOptions = {}) {
    this.audit = options.auditWriter ?? new NoopPluginAuditWriter();
    this.maxCrashes = options.maxCrashesBeforeDisable ?? 3;
    this.windowMs = options.crashWindowMs ?? 5 * 60 * 1000;
    this.onAutoDisable = options.onAutoDisable;
  }

  /**
   * Records a crash event. Returns whether the plugin should be auto-disabled.
   *
   * Per INV-14: this method NEVER throws; crashes are isolated.
   */
  async handleCrash(event: CrashEvent): Promise<{ shouldDisable: boolean; crashCount: number }> {
    const now = Date.now();

    // Update crash window for this plugin
    const times = this.crashTimes.get(event.pluginName) ?? [];
    const recentTimes = times.filter((t) => now - t < this.windowMs);
    recentTimes.push(now);
    this.crashTimes.set(event.pluginName, recentTimes);

    const crashCount = recentTimes.length;
    const shouldDisable = crashCount >= this.maxCrashes;

    // Audit the crash (never throws per INV-14)
    try {
      await this.audit.append({
        kind: 'plugin.crashed',
        ts: event.timestamp,
        actor: { system: 'crash-handler' },
        payload: {
          pluginName: event.pluginName,
          pluginVersion: event.pluginVersion,
          exitCode: event.exitCode,
          signal: event.signal,
          stderrPreview: event.stderr.slice(0, 500),
          uptimeMs: event.uptimeMs,
          crashCount,
          shouldDisable,
        },
      });
    } catch {
      // Even audit failure must not propagate (INV-14 isolation)
    }

    if (shouldDisable && this.onAutoDisable) {
      try {
        this.onAutoDisable(event.pluginName, crashCount);
      } catch {
        // Callback failure isolated
      }
    }

    return { shouldDisable, crashCount };
  }

  /** Resets crash count for a plugin (e.g., after successful re-activation) */
  reset(pluginName: string): void {
    this.crashTimes.delete(pluginName);
  }

  /** Returns crash count within the current window */
  getCrashCount(pluginName: string): number {
    const now = Date.now();
    const times = this.crashTimes.get(pluginName) ?? [];
    return times.filter((t) => now - t < this.windowMs).length;
  }

  /** Clears all crash tracking */
  clearAll(): void {
    this.crashTimes.clear();
  }
}
