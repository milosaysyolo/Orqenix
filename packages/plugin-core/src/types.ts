// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Type definitions

import type { CanonicalSkillFormat, PluginKind } from "./csf-schema";

// ─────────────────────────────────────────────────────────────────────────
// Plugin lifecycle state (per CR v8.0 Section 7.3)
// ─────────────────────────────────────────────────────────────────────────

export type PluginLifecycleState =
  | "unregistered"
  | "installed" // package present, not yet configured
  | "configured" // settings reviewed by user
  | "active" // sandbox spawned, ready to invoke
  | "inactive" // explicitly deactivated, state preserved
  | "crashed" // sandbox crashed, awaiting restart or removal
  | "updating" // mid-update from old → new version
  | "uninstalling"; // being removed

// ─────────────────────────────────────────────────────────────────────────
// Registered plugin entry (in PluginRegistry)
// ─────────────────────────────────────────────────────────────────────────

export interface RegisteredPlugin {
  /** Plugin manifest */
  csf: CanonicalSkillFormat;
  /** Filesystem path to plugin package */
  packagePath: string;
  /** Lifecycle state */
  state: PluginLifecycleState;
  /** When plugin was first installed */
  installedAt: string;
  /** When plugin was last activated (ISO timestamp), or null */
  lastActivatedAt: string | null;
  /** Crash count (resets on successful activate) */
  crashCount: number;
  /** Total successful invocations */
  totalInvocations: number;
  /** Total failed invocations */
  totalErrors: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Invocation request/response (used by Workbench → plugin)
// ─────────────────────────────────────────────────────────────────────────

export interface PluginInvocationRequest {
  /** Plugin to invoke */
  pluginName: string;
  /** Tool name within plugin (for plugins with multiple tools) */
  toolName?: string;
  /** Input matching plugin's declared inputSchema */
  input: unknown;
  /** Optional invocation-specific timeout (overrides plugin default) */
  timeoutMs?: number;
  /** Trace ID for audit + observability */
  traceId?: string;
}

export interface PluginInvocationResult {
  /** Output from plugin matching declared outputSchema */
  output: unknown;
  /** Duration in milliseconds */
  durationMs: number;
  /** BLAKE3 of canonical request payload */
  inputHash: string;
  /** BLAKE3 of canonical response payload */
  outputHash: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Plugin kind handler interface (defined per-kind in src/kinds/)
// ─────────────────────────────────────────────────────────────────────────

export interface PluginKindHandler<TKind extends PluginKind = PluginKind> {
  /** Plugin kind this handler manages */
  kind: TKind;

  /** Human-readable description */
  description: string;

  /**
   * Validates that the manifest is well-formed for THIS kind.
   * (Beyond generic CSF validation, e.g., skill must have manifest.tool)
   */
  validateManifest(csf: CanonicalSkillFormat): ValidationResult;

  /**
   * Optional hook for kind-specific install steps (e.g., download model weights
   * for embedding-model kind).
   */
  onInstall?(csf: CanonicalSkillFormat, packagePath: string): Promise<void>;

  /**
   * Optional hook for kind-specific activate steps.
   */
  onActivate?(csf: CanonicalSkillFormat): Promise<void>;

  /**
   * Optional hook for kind-specific deactivate steps.
   */
  onDeactivate?(csf: CanonicalSkillFormat): Promise<void>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Plugin runtime handle (from sandbox)
// ─────────────────────────────────────────────────────────────────────────

export interface PluginRuntimeHandle {
  /** Plugin manifest */
  csf: CanonicalSkillFormat;
  /** Process ID of sandboxed plugin process */
  pid: number;
  /** When sandbox was spawned */
  spawnedAt: string;
  /** Invoke a tool on this plugin */
  invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult>;
  /** Gracefully shut down */
  terminate(): Promise<void>;
  /** Get current process resource usage */
  getMetrics(): Promise<RuntimeMetrics>;
}

export interface RuntimeMetrics {
  cpuUsagePct: number;
  memoryUsageMb: number;
  uptimeSec: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Plugin discovery result (from PluginLoader)
// ─────────────────────────────────────────────────────────────────────────

export interface PluginDiscoveryResult {
  csf: CanonicalSkillFormat;
  packagePath: string;
  /** Path to entry script */
  entryPath: string;
  /** Whether package.json was a valid Orqenix plugin */
  isValidPlugin: boolean;
  /** Validation issues if any */
  issues: string[];
}
