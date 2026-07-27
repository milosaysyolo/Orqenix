// SPDX-License-Identifier: Apache-2.0
// Skill lifecycle management — real CSF store + MarketplaceCrud + side tables; demo-store fallback

import type { Skill } from '@/lib/demo-store';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { MarketplaceCrud } from '@orqenix/marketplace-core';
import { WorkbenchMarketplaceAuditWriter } from '../audit/marketplace-audit';
import {
  getDb, getLocalStore,
  readPluginMeta, writePluginMeta, readPluginConfig, writePluginConfig,
  readSkillState, writeSkillState,
} from '../engine-init';

// ── Shape mapping ──────────────────────────────────────────────────────────

function csfToSkill(db: ReturnType<typeof getDb>, csf: CanonicalSkillFormat): Skill {
  const meta = readPluginMeta(db!, csf.name);
  return {
    id: csf.name,
    name: csf.name,
    category: meta.category || 'general',
    version: csf.version,
    enabled: readSkillState(db!, csf.name),
    description: meta.description || '',
    config: readPluginConfig(db!, csf.name),
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function getAllSkills(): Promise<Skill[]> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) {
    const { getSkills } = await import('@/lib/demo-store');
    return getSkills();
  }
  const csfs = await store.list();
  return csfs.map((csf) => csfToSkill(db, csf));
}

export async function createSkillItem(data: Partial<Skill>): Promise<Skill> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) {
    const { createSkill } = await import('@/lib/demo-store');
    return createSkill({
      name: data.name ?? 'new-skill',
      category: data.category ?? 'general',
      version: data.version ?? '1.0.0',
      enabled: data.enabled ?? true,
      description: data.description ?? '',
    });
  }
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  const skillName = data.name ?? 'new-skill';
  const toolName = skillName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const res = await crud.create({ name: skillName, kind: 'skill' as const, description: data.description ?? '', permissions: [], external_agent_compat: [], tool: { name: toolName, description: data.description ?? '', inputSchema: { type: 'object', properties: {}, required: [] } } });
  if (!res.ok) throw new Error('skill create failed');
  writePluginMeta(db, res.pluginName, { description: data.description ?? '', category: data.category ?? 'general' });
  if (data.config) writePluginConfig(db, res.pluginName, data.config);
  writeSkillState(db, res.pluginName, data.enabled !== false);
  const csf = await store.get(res.pluginName);
  if (!csf) throw new Error('skill not found after create');
  return csfToSkill(db, csf);
}

export async function updateSkillItem(id: string, data: Partial<Skill>): Promise<Skill | null> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) {
    const { updateSkill } = await import('@/lib/demo-store');
    return updateSkill(id, data) ?? null;
  }
  if (data.description !== undefined) {
    const cur = readPluginMeta(db, id);
    writePluginMeta(db, id, { description: data.description ?? cur.description });
  }
  if (data.category !== undefined) writePluginMeta(db, id, { category: data.category });
  if (data.enabled !== undefined) writeSkillState(db, id, data.enabled);
  if (data.config !== undefined) writePluginConfig(db, id, data.config);
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  await crud.update({ name: id, bump: 'patch', changes: {} });
  const csf = await store.get(id);
  return csf ? csfToSkill(db, csf) : null;
}

export async function deleteSkillItem(id: string): Promise<boolean> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) {
    const { deleteSkill } = await import('@/lib/demo-store');
    return deleteSkill(id);
  }
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  try {
    await crud.delete({ name: id, confirmation: `DELETE ${id}` });
  } catch (err) {
    console.error('[skills/delete]', err);
    return false;
  }
  db.prepare(`DELETE FROM workbench_plugin_meta WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_plugin_config WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_skill_state WHERE name=?`).run(id);
  return true;
}

export async function toggleSkillItem(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const { toggleSkill } = await import('@/lib/demo-store');
    return toggleSkill(id);
  }
  writeSkillState(db, id, !readSkillState(db, id));
  return true;
}

export interface SkillInvocationResult {
  ok: boolean;
  skillId: string;
  skillName: string;
  prompt: string;
  output: string;
  durationMs: number;
}

export async function invokeSkill(id: string, prompt: string): Promise<SkillInvocationResult | null> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) return null;
  const csf = await store.get(id);
  if (!csf) return null;
  const output = csf.implementation ? '[implementation available]' : '[no implementation]';
  db.prepare(`INSERT INTO workbench_skill_invocations (name, invoked_at, prompt, output) VALUES (?, ?, ?, ?)`)
    .run(id, new Date().toISOString(), prompt, output);
  return { ok: true, skillId: id, skillName: csf.name, prompt, output, durationMs: 0 };
}
