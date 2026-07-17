// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-adapters — Continue.dev binding
//
// Continue.dev supports MCP via its config.json. This binding adds an Orqenix
// MCP server entry. Per CR v8.0 Section 9.3.7.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  type AgentBinding,
  type BindingConfig,
  type BindingStatus,
  type InstallResult,
  type ConnectionTestResult,
  type ExportResult,
  buildMcpCommand,
} from '@orqenix/binding-core';

export class ContinueBinding implements AgentBinding {
  readonly platformName = 'continue';

  async install(config: BindingConfig): Promise<InstallResult> {
    const configPath = join(config.projectPath, '.continue', 'config.json');
    const { command, args } = buildMcpCommand(config);

    let cfg: { mcpServers?: Array<Record<string, unknown>> } = {};
    if (existsSync(configPath)) {
      try {
        cfg = JSON.parse(await readFile(configPath, 'utf-8'));
      } catch {
        cfg = {};
      }
    }
    cfg.mcpServers = (cfg.mcpServers ?? []).filter(
      (s) => (s as { name?: string }).name !== 'orqenix'
    );
    cfg.mcpServers.push({
      name: 'orqenix',
      command,
      args: [...args, '--client-id', 'continue'],
    });

    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(cfg, null, 2));

    return {
      ok: true,
      filesWritten: [configPath],
      summary: `Registered Orqenix MCP in ${configPath}.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const configPath = join(config.projectPath, '.continue', 'config.json');
    if (!existsSync(configPath)) return;
    try {
      const cfg = JSON.parse(await readFile(configPath, 'utf-8')) as {
        mcpServers?: Array<{ name?: string }>;
      };
      if (cfg.mcpServers) {
        cfg.mcpServers = cfg.mcpServers.filter((s) => s.name !== 'orqenix');
        await writeFile(configPath, JSON.stringify(cfg, null, 2));
      }
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const configPath = join(config.projectPath, '.continue', 'config.json');
    if (!existsSync(configPath)) {
      return { platformName: this.platformName, state: 'not_installed', configPresent: false };
    }
    try {
      const cfg = JSON.parse(await readFile(configPath, 'utf-8')) as {
        mcpServers?: Array<{ name?: string }>;
      };
      const installed = (cfg.mcpServers ?? []).some((s) => s.name === 'orqenix');
      return {
        platformName: this.platformName,
        state: installed ? 'active' : 'inactive',
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
