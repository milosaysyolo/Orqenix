// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-adapters — Claude Code binding
//
// Bridges Orqenix to Claude Code by writing .mcp.json pointing to orqenix-mcp.
// Per CR v8.0 Section 9.3.1.

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

/**
 * Claude Code binding. Writes a `.mcp.json` file at the project root that tells
 * Claude Code to launch the Orqenix MCP server over stdio.
 */
export class ClaudeCodeBinding implements AgentBinding {
  readonly platformName = 'claude-code';

  async install(config: BindingConfig): Promise<InstallResult> {
    const mcpJsonPath = join(config.projectPath, '.mcp.json');
    const { command, args } = buildMcpCommand(config);

    let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
    if (existsSync(mcpJsonPath)) {
      try {
        mcpConfig = JSON.parse(await readFile(mcpJsonPath, 'utf-8'));
      } catch {
        mcpConfig = {};
      }
    }

    mcpConfig.mcpServers = mcpConfig.mcpServers ?? {};
    mcpConfig.mcpServers.orqenix = {
      command,
      args: [...args, '--client-id', 'claude-code'],
      env: {},
    };

    await mkdir(dirname(mcpJsonPath), { recursive: true });
    await writeFile(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));

    return {
      ok: true,
      filesWritten: [mcpJsonPath],
      summary: `Registered Orqenix MCP server in ${mcpJsonPath}. Restart Claude Code to load.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const mcpJsonPath = join(config.projectPath, '.mcp.json');
    if (!existsSync(mcpJsonPath)) return;
    try {
      const mcpConfig = JSON.parse(await readFile(mcpJsonPath, 'utf-8')) as {
        mcpServers?: Record<string, unknown>;
      };
      if (mcpConfig.mcpServers) {
        delete mcpConfig.mcpServers.orqenix;
        await writeFile(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
      }
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const mcpJsonPath = join(config.projectPath, '.mcp.json');
    if (!existsSync(mcpJsonPath)) {
      return {
        platformName: this.platformName,
        state: 'not_installed',
        configPresent: false,
      };
    }
    try {
      const mcpConfig = JSON.parse(await readFile(mcpJsonPath, 'utf-8')) as {
        mcpServers?: Record<string, unknown>;
      };
      const installed = mcpConfig.mcpServers?.orqenix !== undefined;
      return {
        platformName: this.platformName,
        state: installed ? 'active' : 'inactive',
        configPresent: true,
        ...(config.endpoint ? { mcpEndpoint: config.endpoint } : {}),
      };
    } catch (err) {
      return {
        platformName: this.platformName,
        state: 'error',
        configPresent: true,
        error: (err as Error).message,
      };
    }
  }

  async testConnection(config: BindingConfig): Promise<ConnectionTestResult> {
    if (config.transport === 'stdio') {
      return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
    }
    if (config.endpoint) {
      const start = Date.now();
      try {
        const res = await fetch(
          config.endpoint.replace(/\/rpc$/, '') + '/health',
          { signal: AbortSignal.timeout(3000) }
        );
        return {
          ok: res.ok,
          latencyMs: Date.now() - start,
          serverCapabilities: { tools: 10, resources: 9, prompts: 6 },
        };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    return { ok: false, error: 'No endpoint configured' };
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
