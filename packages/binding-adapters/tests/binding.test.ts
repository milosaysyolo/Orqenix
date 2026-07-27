// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  AiderBinding,
  ClaudeCodeBinding,
  ClineBinding,
  CodexBinding,
  ContinueBinding,
  CursorBinding,
  OpenCodeBinding,
} from '../src/index';
import { parse as parseYaml } from 'yaml';
import type { BindingConfig } from '@orqenix/binding-core';

// ── Shared test helpers ──────────────────────────────────────────────

function tmpConfig(projectPath: string): BindingConfig {
  return { projectPath, transport: 'stdio', autoRegisterSkills: true };
}

// ── ClaudeCodeBinding (ported from binding-claude-code) ──────────────

describe('ClaudeCodeBinding', () => {
  let tmpDir: string;
  let binding: ClaudeCodeBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-cc-test-'));
    binding = new ClaudeCodeBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is claude-code', () => {
    expect(binding.platformName).toBe('claude-code');
  });

  it('install writes .mcp.json with orqenix server', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const mcpJsonPath = join(tmpDir, '.mcp.json');
    expect(existsSync(mcpJsonPath)).toBe(true);

    const content = JSON.parse(await readFile(mcpJsonPath, 'utf-8'));
    expect(content.mcpServers.orqenix).toBeDefined();
    expect(content.mcpServers.orqenix.command).toBe('orqenix-mcp');
    expect(content.mcpServers.orqenix.args).toContain('--client-id');
    expect(content.mcpServers.orqenix.args).toContain('claude-code');
  });

  it('status reports active after install', async () => {
    await binding.install(config);
    const status = await binding.status(config);
    expect(status.state).toBe('active');
    expect(status.configPresent).toBe(true);
  });

  it('status reports not_installed before install', async () => {
    const status = await binding.status(config);
    expect(status.state).toBe('not_installed');
    expect(status.configPresent).toBe(false);
  });

  it('uninstall removes orqenix from .mcp.json', async () => {
    await binding.install(config);
    await binding.uninstall(config);
    const status = await binding.status(config);
    expect(status.state).toBe('inactive');
  });

  it('install preserves other mcp servers', async () => {
    const mcpJsonPath = join(tmpDir, '.mcp.json');
    await writeFile(
      mcpJsonPath,
      JSON.stringify({ mcpServers: { other: { command: 'other-server' } } })
    );

    await binding.install(config);

    const content = JSON.parse(await readFile(mcpJsonPath, 'utf-8'));
    expect(content.mcpServers.other).toBeDefined();
    expect(content.mcpServers.orqenix).toBeDefined();
  });

  it('testConnection ok for stdio transport', async () => {
    const result = await binding.testConnection(config);
    expect(result.ok).toBe(true);
    expect(result.serverCapabilities?.tools).toBe(10);
  });
});

// ── AiderBinding ─────────────────────────────────────────────────────

describe('AiderBinding', () => {
  let tmpDir: string;
  let binding: AiderBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-aider-'));
    binding = new AiderBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is aider', () => {
    expect(binding.platformName).toBe('aider');
  });

  it('install writes .aider.conf.yml with orqenix-mcp section', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const confPath = join(tmpDir, '.aider.conf.yml');
    expect(existsSync(confPath)).toBe(true);

    const content = parseYaml(await readFile(confPath, 'utf-8')) as Record<string, unknown>;
    expect(content['orqenix-mcp']).toBeDefined();
    expect((content['orqenix-mcp'] as { enabled: boolean }).enabled).toBe(true);
  });

  it('status reflects install state', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
  });

  it('uninstall removes orqenix-mcp section', async () => {
    await binding.install(config);
    await binding.uninstall(config);
    expect((await binding.status(config)).state).toBe('inactive');
  });

  it('testConnection returns ok', async () => {
    expect((await binding.testConnection(config)).ok).toBe(true);
  });
});

// ── ClineBinding ─────────────────────────────────────────────────────

describe('ClineBinding', () => {
  let tmpDir: string;
  let binding: ClineBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-cline-'));
    binding = new ClineBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is cline', () => {
    expect(binding.platformName).toBe('cline');
  });

  it('install writes .cline/mcp_settings.json', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const settingsPath = join(tmpDir, '.cline', 'mcp_settings.json');
    expect(existsSync(settingsPath)).toBe(true);
    const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
    expect(content.mcpServers.orqenix).toBeDefined();
    expect(content.mcpServers.orqenix.args).toContain('--client-id');
    expect(content.mcpServers.orqenix.args).toContain('cline');
  });

  it('status lifecycle', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
    await binding.uninstall(config);
    expect((await binding.status(config)).state).toBe('inactive');
  });
});

// ── CodexBinding ─────────────────────────────────────────────────────

describe('CodexBinding', () => {
  let tmpDir: string;
  let binding: CodexBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-codex-'));
    binding = new CodexBinding();
    config = { projectPath: tmpDir, endpoint: 'http://127.0.0.1:27420/rpc', autoRegisterSkills: true };
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is codex', () => {
    expect(binding.platformName).toBe('codex');
  });

  it('install writes codex-connection.json', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const descPath = join(tmpDir, '.orqenix', 'codex-connection.json');
    expect(existsSync(descPath)).toBe(true);
    const content = JSON.parse(await readFile(descPath, 'utf-8'));
    expect(content.platform).toBe('codex');
    expect(content.clientId).toBe('codex');
  });

  it('status lifecycle', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
  });
});

// ── ContinueBinding ──────────────────────────────────────────────────

describe('ContinueBinding', () => {
  let tmpDir: string;
  let binding: ContinueBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-cont-'));
    binding = new ContinueBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is continue', () => {
    expect(binding.platformName).toBe('continue');
  });

  it('install writes .continue/config.json', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const cfgPath = join(tmpDir, '.continue', 'config.json');
    expect(existsSync(cfgPath)).toBe(true);
    const content = JSON.parse(await readFile(cfgPath, 'utf-8'));
    expect(content.mcpServers).toBeDefined();
    const orqenixEntry = content.mcpServers.find((s: { name: string }) => s.name === 'orqenix');
    expect(orqenixEntry).toBeDefined();
  });

  it('status lifecycle', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
  });

  it('preserves existing mcp servers on install', async () => {
    const cfgPath = join(tmpDir, '.continue', 'config.json');
    await mkdir(dirname(cfgPath), { recursive: true });
    await writeFile(cfgPath, JSON.stringify({ mcpServers: [{ name: 'other' }] }));

    await binding.install(config);
    const content = JSON.parse(await readFile(cfgPath, 'utf-8'));
    expect(content.mcpServers.find((s: { name: string }) => s.name === 'other')).toBeDefined();
    expect(content.mcpServers.find((s: { name: string }) => s.name === 'orqenix')).toBeDefined();
  });
});

// ── CursorBinding ────────────────────────────────────────────────────

describe('CursorBinding', () => {
  let tmpDir: string;
  let binding: CursorBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-curs-'));
    binding = new CursorBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is cursor', () => {
    expect(binding.platformName).toBe('cursor');
  });

  it('install writes .cursor/mcp.json', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const mcpPath = join(tmpDir, '.cursor', 'mcp.json');
    expect(existsSync(mcpPath)).toBe(true);
    const content = JSON.parse(await readFile(mcpPath, 'utf-8'));
    expect(content.mcpServers.orqenix).toBeDefined();
    expect(content.mcpServers.orqenix.args).toContain('--client-id');
    expect(content.mcpServers.orqenix.args).toContain('cursor');
  });

  it('status lifecycle', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
    await binding.uninstall(config);
    expect((await binding.status(config)).state).toBe('inactive');
  });
});

// ── OpenCodeBinding ──────────────────────────────────────────────────

describe('OpenCodeBinding', () => {
  let tmpDir: string;
  let binding: OpenCodeBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-oc-'));
    binding = new OpenCodeBinding();
    config = tmpConfig(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('platformName is opencode', () => {
    expect(binding.platformName).toBe('opencode');
  });

  it('install writes .opencode/mcp.yaml', async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const yamlPath = join(tmpDir, '.opencode', 'mcp.yaml');
    expect(existsSync(yamlPath)).toBe(true);
    const content = parseYaml(await readFile(yamlPath, 'utf-8')) as Record<string, unknown>;
    const servers = content.mcp_servers as Record<string, unknown>;
    expect(servers.orqenix).toBeDefined();
    expect((servers.orqenix as { args: string[] }).args).toContain('--client-id');
    expect((servers.orqenix as { args: string[] }).args).toContain('opencode');
  });

  it('status lifecycle', async () => {
    expect((await binding.status(config)).state).toBe('not_installed');
    await binding.install(config);
    expect((await binding.status(config)).state).toBe('active');
    await binding.uninstall(config);
    expect((await binding.status(config)).state).toBe('inactive');
  });
});
