// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Audit kinds for plugin lifecycle events
//
// Per CR v8.0 Chapter 7 + Section 4.9, plugin events are audited in the
// project's audit chain. Adding new kinds requires CR amendment.

export type PluginAuditKind =
  | "plugin.manifest_validated"
  | "plugin.installed"
  | "plugin.install_failed"
  | "plugin.configured"
  | "plugin.activated"
  | "plugin.activate_failed"
  | "plugin.deactivated"
  | "plugin.uninstalled"
  | "plugin.updated"
  | "plugin.crashed"
  | "plugin.permission_check"
  | "plugin.invocation"
  | "plugin.invocation_failed";

/**
 * Type guard for plugin audit kinds
 */
export function isPluginAuditKind(s: string): s is PluginAuditKind {
  return PLUGIN_AUDIT_KINDS.has(s);
}

const PLUGIN_AUDIT_KINDS: ReadonlySet<string> = new Set([
  "plugin.manifest_validated",
  "plugin.installed",
  "plugin.install_failed",
  "plugin.configured",
  "plugin.activated",
  "plugin.activate_failed",
  "plugin.deactivated",
  "plugin.uninstalled",
  "plugin.updated",
  "plugin.crashed",
  "plugin.permission_check",
  "plugin.invocation",
  "plugin.invocation_failed",
]);

/**
 * Audit chain writer interface (provided by D8.α.6 Memory Engine).
 * For D8.α.4, we accept any implementation matching this shape.
 */
export interface PluginAuditWriter {
  append(event: {
    kind: PluginAuditKind;
    ts: string;
    actor: { user?: string; system?: string };
    payload: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * No-op writer used when audit chain is unavailable (e.g., tests).
 */
export class NoopPluginAuditWriter implements PluginAuditWriter {
  async append(): Promise<void> {
    // intentionally empty
  }
}

/**
 * In-memory writer for tests (records events for later verification).
 */
export class InMemoryPluginAuditWriter implements PluginAuditWriter {
  private readonly events: Array<Parameters<PluginAuditWriter["append"]>[0]> = [];

  async append(event: Parameters<PluginAuditWriter["append"]>[0]): Promise<void> {
    this.events.push(event);
  }

  getEvents(): readonly Parameters<PluginAuditWriter["append"]>[0][] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}
