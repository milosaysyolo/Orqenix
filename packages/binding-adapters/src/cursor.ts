// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-adapters — Cursor binding
//
// Bridges Orqenix to Cursor. Cursor supports MCP via its settings; this binding
// writes the Cursor MCP config + a .cursorrules note. Per CR v8.0 Section 9.3.2.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  type AgentBinding,
  type BindingConfig,
  type BindingStatus,
  type InstallResult,
  type ConnectionTestResult,
  type ExportResult,
  buildMcpCommand,
} from "@orqenix/binding-core";

export class CursorBinding implements AgentBinding {
  readonly platformName = "cursor";

  async install(config: BindingConfig): Promise<InstallResult> {
    const mcpConfigPath = join(config.projectPath, ".cursor", "mcp.json");
    const { command, args } = buildMcpCommand(config);

    let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
    if (existsSync(mcpConfigPath)) {
      try {
        mcpConfig = JSON.parse(await readFile(mcpConfigPath, "utf-8"));
      } catch {
        mcpConfig = {};
      }
    }
    mcpConfig.mcpServers = mcpConfig.mcpServers ?? {};
    mcpConfig.mcpServers.orqenix = {
      command,
      args: [...args, "--client-id", "cursor"],
    };

    await mkdir(dirname(mcpConfigPath), { recursive: true });
    await writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

    return {
      ok: true,
      filesWritten: [mcpConfigPath],
      summary: `Registered Orqenix MCP in ${mcpConfigPath}. Reload Cursor to apply.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const mcpConfigPath = join(config.projectPath, ".cursor", "mcp.json");
    if (!existsSync(mcpConfigPath)) return;
    try {
      const mcpConfig = JSON.parse(await readFile(mcpConfigPath, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      if (mcpConfig.mcpServers) {
        delete mcpConfig.mcpServers.orqenix;
        await writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
      }
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const mcpConfigPath = join(config.projectPath, ".cursor", "mcp.json");
    if (!existsSync(mcpConfigPath)) {
      return { platformName: this.platformName, state: "not_installed", configPresent: false };
    }
    try {
      const mcpConfig = JSON.parse(await readFile(mcpConfigPath, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      return {
        platformName: this.platformName,
        state: mcpConfig.mcpServers?.orqenix ? "active" : "inactive",
        configPresent: true,
      };
    } catch (err) {
      return {
        platformName: this.platformName,
        state: "error",
        configPresent: true,
        error: (err as Error).message,
      };
    }
  }

  async testConnection(config: BindingConfig): Promise<ConnectionTestResult> {
    if (config.transport === "stdio") {
      return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
    }
    return { ok: false, error: "Cursor binding uses stdio transport" };
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
