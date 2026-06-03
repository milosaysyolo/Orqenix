import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { platform } from 'node:os';
import { initScope, loadScope } from '../src/init';
import { ScopeYamlCorruptError, KeyPairMismatchError } from '../src/contracts';
import { generateKeyPair, serializePrivateKey } from '../src/keypair';

const IS_WIN = platform() === 'win32';

describe('init', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'orqenix-init-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('creates scope.yaml and identity.key with correct perms', async () => {
    const r = await initScope({ rootDir: root, name: 'demo-scope' });
    expect(r.scopeId).toMatch(/^scope:[A-Z2-7]{32}$/);
    const yamlStat = await stat(r.scopeYamlPath);
    const keyStat = await stat(r.identityKeyPath);
    expect(yamlStat.isFile()).toBe(true);
    expect(keyStat.isFile()).toBe(true);
    // On Unix, verify mode 0600; on Windows skip permission bits
    if (!IS_WIN) {
      expect(keyStat.mode & 0o077).toBe(0);
    }
  });

  it('updates .gitignore with identity.key entry', async () => {
    await initScope({ rootDir: root, name: 'demo' });
    const gi = await readFile(join(root, '.gitignore'), 'utf-8');
    expect(gi).toContain('.orqenix/identity.key');
    expect(gi).toContain('.orqenix/gate-reports/');
  });

  it('refuses to clobber existing scope', async () => {
    await initScope({ rootDir: root, name: 'demo' });
    await expect(initScope({ rootDir: root, name: 'demo' })).rejects.toThrow(/refusing to clobber/);
  });

  it('loadScope returns matching pair and yaml', async () => {
    const r = await initScope({ rootDir: root, name: 'demo' });
    const loaded = await loadScope(root);
    expect(loaded.scopeYaml.scopeId).toBe(r.scopeId);
    expect(loaded.keyPair.publicKey).toHaveLength(32);
  });

  it('loadScope detects tampered identity.key', async () => {
    const r = await initScope({ rootDir: root, name: 'demo' });
    const other = await generateKeyPair();
    await writeFile(r.identityKeyPath, serializePrivateKey(other.privateKey), { mode: 0o600 });
    await expect(loadScope(root)).rejects.toThrow(KeyPairMismatchError);
  });

  it('loadScope detects corrupt scope.yaml scopeId', async () => {
    const r = await initScope({ rootDir: root, name: 'demo' });
    const yaml = await readFile(r.scopeYamlPath, 'utf-8');
    const tampered = yaml.replace(/scope:[A-Z2-7]{32}/, 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await writeFile(r.scopeYamlPath, tampered);
    await expect(loadScope(root)).rejects.toThrow(ScopeYamlCorruptError);
  });
});
