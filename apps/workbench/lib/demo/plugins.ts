// SPDX-License-Identifier: Apache-2.0

import { eventBus } from '../event-bus';
import { store } from './memory';
import type { Plugin } from './memory';

// ---- READS -----------------------------------------------------------------

export function getPlugins() { return store().plugins; }

// ---- Plugin Toggle ---------------------------------------------------------

export function togglePlugin(id: string): boolean {
  const p = store().plugins.find((x) => x.id === id);
  if (!p) return false;
  p.enabled = !p.enabled;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'plugin.toggle', id, name: p.name, enabled: p.enabled } });
  return true;
}

// ---- Plugin Lifecycle ------------------------------------------------------

const LIFECYCLE_STAGES = ['install', 'configure', 'activate', 'deactivate', 'uninstall'] as const;
const lifecycleState = new Map<string, string>();

export function getPluginLifecycleState(kind: string): string {
  return lifecycleState.get(kind) ?? 'install';
}

export function advancePluginLifecycle(kind: string): string | null {
  const current = lifecycleState.get(kind) ?? 'install';
  const idx = LIFECYCLE_STAGES.indexOf(current as typeof LIFECYCLE_STAGES[number]);
  if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
  const next = LIFECYCLE_STAGES[idx + 1]!;
  lifecycleState.set(kind, next);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'plugin.lifecycle', kind, stage: next } });
  return next;
}

// ---- CRUD: Plugins ----------------------------------------------------------

export function createPlugin(data: Omit<Plugin, 'id'>): Plugin {
  const s = store();
  const id = `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const plugin: Plugin = { id, ...data };
  s.plugins.push(plugin);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'create.plugin', id, name: data.name } });
  return plugin;
}

export function updatePlugin(id: string, data: Partial<Plugin>): Plugin | null {
  const s = store();
  const existing = s.plugins.find((p) => p.id === id);
  if (!existing) return null;
  const merged: Plugin = {
    id: existing.id,
    name: data.name ?? existing.name,
    version: data.version ?? existing.version,
    enabled: data.enabled ?? existing.enabled,
    description: data.description ?? existing.description,
    author: data.author ?? existing.author,
    config: data.config ?? existing.config,
  };
  const idx = s.plugins.indexOf(existing);
  s.plugins[idx] = merged;
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'update.plugin', id } });
  return merged;
}

export function deletePlugin(id: string): boolean {
  const s = store();
  const idx = s.plugins.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  s.plugins.splice(idx, 1);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'delete.plugin', id } });
  return true;
}
