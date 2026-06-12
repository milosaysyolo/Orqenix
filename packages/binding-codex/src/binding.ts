// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-codex , ChatGPT Codex binding
//
// Codex (web) integrates via HTTP transport. This binding writes a config
// pointing Codex at the Orqenix MCP HTTP endpoint. Per CR v8.0 Section 9.3.3.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  type AgentBinding,
  type BindingConfig,
  type BindingStatus,
  type InstallResult,
  type ConnectionTestResult,
  type ExportResult,
} from '@orqenix/binding-core';

export class CodexBinding implements AgentBinding {
  readonly platformName = 'codex';

  async install(config: BindingConfig): Promise<InstallResult> {
    // Codex uses HTTP transport (web-based). Write a connection descriptor.
    const descriptorPath = join(config.projectPath, '.orqenix', 'codex-connection.json');
    const endpoint = config.endpoint ?? 'http://127.0.0.1:27420/rpc';

    const descriptor = {
      platform: 'codex',
      mcpEndpoint: endpoint,
      clientId: 'codex',
      transport: 'http',
      note: 'Configure ChatGPT Codex to use this Orqenix MCP HTTP endpoint.',
    };

    await mkdir(dirname(descriptorPath), { recursive: true });
    await writeFile(descriptorPath, JSON.stringify(descriptor, null, 2));

    return {
      ok: true,
      filesWritten: [descriptorPath],
      summary: `Codex connection descriptor written. Endpoint: ${endpoint}`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const descriptorPath = join(config.projectPath, '.orqenix', 'codex-connection.json');
    if (existsSync(descriptorPath)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(descriptorPath);
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const descriptorPath = join(config.projectPath, '.orqenix', 'codex-connection.json');
    if (!existsSync(descriptorPath)) {
      return { platformName: this.platformName, state: 'not_installed', configPresent: false };
    }
    try {
      const d = JSON.parse(await readFile(descriptorPath, 'utf-8')) as { mcpEndpoint?: string };
      return {
        platformName: this.platformName,
        state: 'active',
        configPresent: true,
        ...(d.mcpEndpoint ? { mcpEndpoint: d.mcpEndpoint } : {}),
      };
    } catch (err) {
      return { platformName: this.platformName, state: 'error', configPresent: true, error: (err as Error).message };
    }
  }

  async testConnection(config: BindingConfig): Promise<ConnectionTestResult> {
    const endpoint = config.endpoint ?? 'http://127.0.0.1:27420/rpc';
    const start = Date.now();
    try {
      const res = await fetch(endpoint.replace(/\/rpc$/, '') + '/health', {
        signal: AbortSignal.timeout(3000),
      });
      return {
        ok: res.ok,
        latencyMs: Date.now() - start,
        serverCapabilities: { tools: 10, resources: 9, prompts: 6 },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
