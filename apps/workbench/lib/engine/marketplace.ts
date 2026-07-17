// SPDX-License-Identifier: Apache-2.0
// Marketplace operations — CSF catalog + registry install/uninstall; demo-store fallback

import type { MarketplaceItem } from '@/lib/demo-store';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import {
  getDb, getLocalStore, getPluginRegistrySync, readPluginMeta,
} from '../engine-init';
import { installLocalPlugin } from './plugins';

export const ALL_MARKETPLACE_KINDS = [
  'knowledge-source', 'embedding-model', 'reranker', 'compression-strategy',
  'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer',
  'kb-schema', 'mcp-server', 'agent', 'subagent', 'skill', 'agent-binding',
] as const;

// ── Shape mapping ──────────────────────────────────────────────────────────

function csfToMarketplaceItem(db: ReturnType<typeof getDb>, csf: CanonicalSkillFormat, installed: boolean): MarketplaceItem {
  const meta = readPluginMeta(db!, csf.name);
  const author = meta.author || csf.provenance.imported_from?.kind || 'local';
  return {
    id: csf.name,
    name: csf.name,
    kind: csf.kind,
    description: meta.description || '',
    author,
    publisher: author,
    version: csf.version,
    downloads: 0,
    rating: 0,
    license: csf.manifest.license || 'MIT',
    source: 'local',
    verified: false,
    installed,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getMarketplaceItems(
  kind?: string, query?: string, tab?: string
): Promise<{ items: MarketplaceItem[]; kinds: readonly string[] }> {
  const db = getDb();
  const store = getLocalStore();
  const reg = getPluginRegistrySync();
  if (!db || !store) {
    const { getMarketplace } = await import('@/lib/demo-store');
    let items = getMarketplace();
    if (tab === 'installed') items = items.filter((i) => i.installed);
    if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q));
    }
    return { items, kinds: ALL_MARKETPLACE_KINDS };
  }
  const csfs = await store.list();
  let items = csfs.map((csf) => csfToMarketplaceItem(db, csf, reg ? reg.find(csf.name) != null : false));
  if (tab === 'installed') items = items.filter((i) => i.installed);
  if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.author.toLowerCase().includes(q));
  }
  return { items, kinds: ALL_MARKETPLACE_KINDS };
}

export async function marketplaceInstall(name: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  if (!reg) {
    const { toggleInstall, syncMarketplaceInstall } = await import('@/lib/demo-store');
    toggleInstall(name);
    syncMarketplaceInstall(name);
    return true;
  }
  return installLocalPlugin(name);
}

export async function marketplaceUninstall(name: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  if (!reg) {
    const { toggleInstall, syncMarketplaceUninstall } = await import('@/lib/demo-store');
    toggleInstall(name);
    syncMarketplaceUninstall(name);
    return true;
  }
  try {
    await reg.unregister(name);
    await reg.flush();
    return true;
  } catch (err) {
    console.error('[marketplace/uninstall]', err);
    return false;
  }
}
