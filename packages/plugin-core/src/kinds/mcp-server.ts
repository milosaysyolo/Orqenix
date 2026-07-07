// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 10: mcp-server
//
// Expose MCP Server endpoints (tools + resources + prompts) over stdio/HTTP/WS.

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const mcpServerHandler: PluginKindHandler<"mcp-server"> = {
  kind: "mcp-server",
  description:
    "Exposes MCP Server endpoints (tools + resources + prompts) over stdio/HTTP/WebSocket.",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // MCP servers must declare compatibility.mcp version
    if (!csf.manifest.compatibility.mcp) {
      errors.push(
        'mcp-server plugins MUST declare compatibility.mcp version range (e.g., ">=0.5.0")',
      );
    }

    // MCP servers are long-running; should use separate_process sandbox
    if (csf.manifest.sandboxMode === "in_process_trusted") {
      warnings.push(
        "mcp-server plugins should use separate_process sandbox (long-running servers in-process risk Workbench stability)",
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  async onActivate(csf: CanonicalSkillFormat): Promise<void> {
    // MCP server activate starts the server process and waits for handshake.
    // D8.α.7 (Agent Ecosystem) wires the MCP handshake protocol.
    void csf;
  },

  async onDeactivate(csf: CanonicalSkillFormat): Promise<void> {
    // MCP server deactivate sends graceful shutdown to the server.
    void csf;
  },
};
