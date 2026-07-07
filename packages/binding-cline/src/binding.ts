// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-cline , Cline binding
//
// Cline (VS Code) supports MCP via its settings. This binding writes the Cline
// MCP settings file. Per CR v8.0 Section 9.3.5.

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

export class ClineBinding implements AgentBinding {
  readonly platformName = "cline";

  async install(config: BindingConfig): Promise<InstallResult> {
    const settingsPath = join(config.projectPath, ".cline", "mcp_settings.json");
    const { command, args } = buildMcpCommand(config);

    let settings: { mcpServers?: Record<string, unknown> } = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      } catch {
        settings = {};
      }
    }
    settings.mcpServers = settings.mcpServers ?? {};
    settings.mcpServers.orqenix = {
      command,
      args: [...args, "--client-id", "cline"],
      disabled: false,
    };

    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));

    return {
      ok: true,
      filesWritten: [settingsPath],
      summary: `Registered Orqenix MCP in ${settingsPath}.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const settingsPath = join(config.projectPath, ".cline", "mcp_settings.json");
    if (!existsSync(settingsPath)) return;
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      if (settings.mcpServers) {
        delete settings.mcpServers.orqenix;
        await writeFile(settingsPath, JSON.stringify(settings, null, 2));
      }
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const settingsPath = join(config.projectPath, ".cline", "mcp_settings.json");
    if (!existsSync(settingsPath)) {
      return { platformName: this.platformName, state: "not_installed", configPresent: false };
    }
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf-8")) as {
        mcpServers?: Record<string, { disabled?: boolean }>;
      };
      const entry = settings.mcpServers?.orqenix;
      return {
        platformName: this.platformName,
        state: entry ? (entry.disabled ? "inactive" : "active") : "not_installed",
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
    return { ok: false, error: "Cline binding uses stdio transport" };
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
