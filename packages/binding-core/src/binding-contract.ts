// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-core , Shared agent binding contract
//
// All 7 platform bindings implement AgentBinding. Per CR v8.0 Section 9.3 +
// Anti-pattern 41 (no vendor lock-in, all Apache-2.0).

export type BindingStatusState = "active" | "inactive" | "error" | "not_installed";

export interface BindingStatus {
  platformName: string;
  state: BindingStatusState;
  /** Whether the platform config file exists */
  configPresent: boolean;
  /** MCP server endpoint the binding points to */
  mcpEndpoint?: string;
  /** Last error message if state === 'error' */
  error?: string;
}

export interface BindingConfig {
  /** Path to the Orqenix project (.orqenix/) */
  projectPath: string;
  /** MCP transport the binding should use */
  transport: "stdio" | "http" | "websocket";
  /** For http/ws transports: the endpoint */
  endpoint?: string;
  /** Auto-register installed Orqenix skills with the platform */
  autoRegisterSkills?: boolean;
  /** Report session lifecycle to Orqenix */
  sessionReporting?: boolean;
  /** Capture observations for self-learning */
  observationCapture?: boolean;
}

export interface InstallResult {
  ok: boolean;
  /** Files written/modified by the install */
  filesWritten: string[];
  /** Human-readable summary */
  summary: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs?: number;
  serverCapabilities?: {
    tools: number;
    resources: number;
    prompts: number;
  };
  error?: string;
}

export interface ExportResult {
  ok: boolean;
  /** Number of skills exported to the platform */
  skillsExported: number;
  /** Files written */
  filesWritten: string[];
}

/**
 * AgentBinding , the contract every platform binding implements.
 *
 * Per Anti-pattern 41: bindings MUST be Apache-2.0 and MUST NOT lock users in.
 * Each binding bridges Orqenix to a specific platform via that platform's
 * native integration mechanism (config file, extension, plugin, etc.).
 */
export interface AgentBinding {
  /** Platform identifier (e.g., 'claude-code') */
  readonly platformName: string;

  /** Installs the binding (writes platform config pointing to Orqenix MCP) */
  install(config: BindingConfig): Promise<InstallResult>;

  /** Uninstalls the binding (removes platform config) */
  uninstall(config: BindingConfig): Promise<void>;

  /** Returns the current binding status */
  status(config: BindingConfig): Promise<BindingStatus>;

  /** Tests the connection to the Orqenix MCP server */
  testConnection(config: BindingConfig): Promise<ConnectionTestResult>;

  /** Exports installed Orqenix skills to the platform's skill format */
  exportSkillsToPlatform(config: BindingConfig): Promise<ExportResult>;
}

/** Helper: resolves the MCP server bin path for stdio transport */
export function resolveMcpBinPath(): string {
  // The orqenix-mcp bin is installed alongside @orqenix/mcp-server.
  // Bindings reference it via npx or the resolved node_modules path.
  return "orqenix-mcp";
}

/** Helper: builds the standard MCP server command for a config */
export function buildMcpCommand(config: BindingConfig): {
  command: string;
  args: string[];
} {
  const args = ["--project", config.projectPath, "--transport", config.transport];
  if (config.endpoint && config.transport !== "stdio") {
    const url = new URL(config.endpoint);
    args.push("--port", url.port || "27420");
  }
  return { command: resolveMcpBinPath(), args };
}
