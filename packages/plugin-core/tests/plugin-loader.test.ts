// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PluginLoader } from '../src/plugin-loader';
import { PluginNotFoundError } from '../src/errors';

async function writePlugin(
  dir: string,
  pkg: Record<string, unknown>
): Promise<string> {
  const pluginDir = join(dir, 'plugin');
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, 'package.json'), JSON.stringify(pkg, null, 2));
  return pluginDir;
}

function validPkg(name = '@example/skill') {
  return {
    name,
    version: '1.0.0',
    license: 'Apache-2.0',
    main: './dist/plugin.js',
    orqenixPlugin: {
      manifestVersion: '1.0',
      kind: 'skill',
      compatibility: { orqenix: '>=0.8.0' },
      permissions: ['scope.read'],
      external_agent_compat: ['claude-code'],
      tool: {
        name: 'test',
        description: 'Test skill',
        inputSchema: { type: 'object' },
      },
    },
  };
}

describe('PluginLoader', () => {
  let tmpDir: string;
  let loader: PluginLoader;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'orqenix-loader-'));
    loader = new PluginLoader();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads a valid plugin', async () => {
    const pluginDir = await writePlugin(tmpDir, validPkg());
    const result = await loader.load(pluginDir);
    expect(result.isValidPlugin).toBe(true);
    expect(result.csf.name).toBe('@example/skill');
  });

  it('computes a real content hash (not placeholder)', async () => {
    const pluginDir = await writePlugin(tmpDir, validPkg());
    const result = await loader.load(pluginDir);
    expect(result.csf.provenance.contentHash).toMatch(/^[0-9a-f]{16,}$/);
    expect(result.csf.provenance.contentHash).not.toBe('0'.repeat(32));
  });

  it('resolves entry path relative to package', async () => {
    const pluginDir = await writePlugin(tmpDir, validPkg());
    const result = await loader.load(pluginDir);
    expect(result.entryPath).toContain('dist/plugin.js');
  });

  it('throws PluginNotFoundError for missing package.json', async () => {
    await expect(loader.load(join(tmpDir, 'nonexistent'))).rejects.toBeInstanceOf(
      PluginNotFoundError
    );
  });

  it('marks invalid plugin as isValidPlugin=false', async () => {
    const pluginDir = await writePlugin(tmpDir, {
      name: 'foo',
      version: '1.0.0',
    });
    const result = await loader.load(pluginDir);
    expect(result.isValidPlugin).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('loadAll discovers plugins and skips non-plugins', async () => {
    const p1 = join(tmpDir, 'pkg-a');
    await mkdir(p1, { recursive: true });
    await writeFile(join(p1, 'package.json'), JSON.stringify(validPkg('@a/skill')));

    const p2 = join(tmpDir, 'pkg-b');
    await mkdir(p2, { recursive: true });
    await writeFile(
      join(p2, 'package.json'),
      JSON.stringify({ name: 'plain', version: '1.0.0' })
    );

    const results = await loader.loadAll(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]?.csf.name).toBe('@a/skill');
  });

  it('loadAll returns empty for nonexistent directory', async () => {
    const results = await loader.loadAll(join(tmpDir, 'nope'));
    expect(results).toEqual([]);
  });
});
