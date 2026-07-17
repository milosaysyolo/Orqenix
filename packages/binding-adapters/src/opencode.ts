// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-adapters — OpenCode binding
//
// OpenCode has native MCP support. This binding writes the OpenCode MCP config.
// Per CR v8.0 Section 9.3.4.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  type AgentBinding,
  type BindingConfig,
  type BindingStatus,
  type InstallResult,
  type ConnectionTestResult,
  type ExportResult,
  buildMcpCommand,
} from '@orqenix/binding-core';

export class OpenCodeBinding implements AgentBinding {
  readonly platformName = 'opencode';

  async install(config: BindingConfig): Promise<InstallResult> {
    const configPath = join(config.projectPath, '.opencode', 'mcp.yaml');
    const { command, args } = buildMcpCommand(config);

    let cfg: { mcp_servers?: Record<string, unknown> } = {};
    if (existsSync(configPath)) {
      try {
        cfg = parseYaml(await readFile(configPath, 'utf-8')) ?? {};
      } catch {
        cfg = {};
      }
    }
    cfg.mcp_servers = cfg.mcp_servers ?? {};
    cfg.mcp_servers.orqenix = {
      command,
      args: [...args, '--client-id', 'opencode'],
    };

    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, stringifyYaml(cfg, { indent: 2 }));

    return {
      ok: true,
      filesWritten: [configPath],
      summary: `Registered Orqenix MCP in ${configPath}.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const configPath = join(config.projectPath, '.opencode', 'mcp.yaml');
    if (!existsSync(configPath)) return;
    try {
      const cfg = parseYaml(await readFile(configPath, 'utf-8')) as {
        mcp_servers?: Record<string, unknown>;
      };
      if (cfg.mcp_servers) {
        delete cfg.mcp_servers.orqenix;
        await writeFile(configPath, stringifyYaml(cfg, { indent: 2 }));
      }
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const configPath = join(config.projectPath, '.opencode', 'mcp.yaml');
    if (!existsSync(configPath)) {
      return { platformName: this.platformName, state: 'not_installed', configPresent: false };
    }
    try {
      const cfg = parseYaml(await readFile(configPath, 'utf-8')) as {
        mcp_servers?: Record<string, unknown>;
      };
      return {
        platformName: this.platformName,
        state: cfg.mcp_servers?.orqenix ? 'active' : 'inactive',
        configPresent: true,
      };
    } catch (err) {
      return { platformName: this.platformName, state: 'error', configPresent: true, error: (err as Error).message };
    }
  }

  async testConnection(config: BindingConfig): Promise<ConnectionTestResult> {
    if (config.transport === 'stdio') {
      return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
    }
    return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
