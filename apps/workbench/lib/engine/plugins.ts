// SPDX-License-Identifier: Apache-2.0
// Plugin lifecycle management — real PluginRegistry backed by installed_plugins; demo-store fallback

import type { Plugin } from '@/lib/demo-store';
import type {
  RegisteredPlugin, CanonicalSkillFormat, PluginDiscoveryResult,
} from '@orqenix/plugin-core';
import { MarketplaceCrud } from '@orqenix/marketplace-core';
import { SqliteLocalPluginStore } from '../marketplace-store';
import { WorkbenchMarketplaceAuditWriter } from '../audit/marketplace-audit';
import {
  getDb, getLocalStore, getPluginRegistrySync,
  readPluginMeta, writePluginMeta, readPluginConfig, writePluginConfig,
} from '../engine-init';

// ── Shape mapping ──────────────────────────────────────────────────────────

function regToPlugin(db: ReturnType<typeof getDb>, reg: RegisteredPlugin): Plugin {
  const csf = reg.csf;
  const meta = readPluginMeta(db!, csf.name);
  return {
    id: csf.name,
    name: csf.name,
    version: csf.version,
    enabled: reg.state === 'active',
    description: meta.description || '',
    author: meta.author || csf.provenance.imported_from?.kind || 'local',
    config: readPluginConfig(db!, csf.name),
  };
}

function fallbackRegisteredPlugin(csf: CanonicalSkillFormat): RegisteredPlugin {
  const now = new Date().toISOString();
  return {
    csf,
    packagePath: csf.name,
    state: 'installed',
    installedAt: now,
    lastActivatedAt: null,
    crashCount: 0,
    totalInvocations: 0,
    totalErrors: 0,
  };
}

// ── Install helper ─────────────────────────────────────────────────────────

export async function installLocalPlugin(name: string): Promise<boolean> {
  const reg = globalThis.__orqenixPluginRegistry;
  const engine = globalThis.__orqenixMemory;
  if (!reg || !engine) return false;
  const csf = await new SqliteLocalPluginStore(engine).get(name);
  if (!csf) return false;
  const discovery: PluginDiscoveryResult = {
    csf,
    packagePath: name,
    entryPath: '',
    isValidPlugin: true,
    issues: [],
  };
  try {
    await reg.register(discovery);
    await reg.setState(name, 'active');
    await reg.flush();
    return true;
  } catch (err) {
    console.error('[plugins/install]', err);
    return false;
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function getAllPlugins(): Promise<Plugin[]> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) {
    const { getPlugins } = await import('@/lib/demo-store');
    return getPlugins();
  }
  return reg.list().map((r) => regToPlugin(db, r));
}

export async function getPluginById(id: string): Promise<Plugin | null> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) {
    const { getPlugins } = await import('@/lib/demo-store');
    return getPlugins().find((p) => p.id === id) ?? null;
  }
  const r = reg.find(id);
  return r ? regToPlugin(db, r) : null;
}

export async function createPluginItem(data: Partial<Plugin>): Promise<Plugin> {
  const db = getDb();
  const store = getLocalStore();
  const reg = getPluginRegistrySync();
  if (!db || !store || !reg) {
    const { createPlugin } = await import('@/lib/demo-store');
    return createPlugin({
      name: data.name ?? 'new-plugin',
      version: data.version ?? '1.0.0',
      enabled: data.enabled ?? true,
      description: data.description ?? '',
      author: data.author ?? 'user',
    });
  }
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  const pluginName = data.name ?? 'new-plugin';
  const toolName = pluginName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const res = await crud.create({ name: pluginName, kind: 'skill' as const, description: data.description ?? '', permissions: [], external_agent_compat: [], tool: { name: toolName, description: data.description ?? '', inputSchema: { type: 'object', properties: {}, required: [] } } });
  if (!res.ok) throw new Error('plugin create failed');
  writePluginMeta(db, res.pluginName, { description: data.description ?? '', author: data.author ?? 'local' });
  if (data.config) writePluginConfig(db, res.pluginName, data.config);
  const csf = await store.get(res.pluginName);
  if (!csf) throw new Error('plugin not found after create');
  if (data.enabled !== false) {
    await installLocalPlugin(res.pluginName);
    return regToPlugin(db, reg.get(res.pluginName));
  }
  return regToPlugin(db, fallbackRegisteredPlugin(csf));
}

export async function updatePluginItem(id: string, data: Partial<Plugin>): Promise<Plugin | null> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) {
    const { updatePlugin } = await import('@/lib/demo-store');
    return updatePlugin(id, data) ?? null;
  }
  if (data.description !== undefined || data.author !== undefined) {
    const cur = readPluginMeta(db, id);
    writePluginMeta(db, id, { description: data.description ?? cur.description, author: data.author ?? cur.author });
  }
  if (data.config !== undefined) writePluginConfig(db, id, data.config);
  if (data.enabled !== undefined) {
    const cur = reg.find(id);
    if (cur) {
      await reg.setState(id, data.enabled ? 'active' : 'inactive');
      await reg.flush();
    }
  }
  const r = reg.find(id);
  return r ? regToPlugin(db, r) : null;
}

export async function deletePluginItem(id: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) {
    const { deletePlugin } = await import('@/lib/demo-store');
    return deletePlugin(id);
  }
  try {
    await reg.unregister(id);
    await reg.flush();
  } catch (err) {
    console.error('[plugins/delete]', err);
    return false;
  }
  db.prepare(`DELETE FROM workbench_plugin_meta WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_plugin_config WHERE name=?`).run(id);
  return true;
}

export async function togglePluginItem(id: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) {
    const { togglePlugin } = await import('@/lib/demo-store');
    return togglePlugin(id);
  }
  const cur = reg.find(id);
  if (!cur) return false;
  await reg.setState(id, cur.state === 'active' ? 'inactive' : 'active');
  await reg.flush();
  return true;
}

export async function getPluginConfig(id: string): Promise<string> {
  const db = getDb();
  if (!db) {
    const { getPlugins } = await import('@/lib/demo-store');
    return getPlugins().find((p) => p.id === id)?.config ?? '';
  }
  return readPluginConfig(db, id);
}

export async function updatePluginConfig(id: string, config: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const { updatePlugin } = await import('@/lib/demo-store');
    return !!updatePlugin(id, { config });
  }
  writePluginConfig(db, id, config);
  return true;
}
