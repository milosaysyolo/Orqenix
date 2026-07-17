// SPDX-License-Identifier: Apache-2.0

import { eventBus } from '../event-bus';
import { store } from './memory';
import type { Skill } from './memory';

// ---- READS -----------------------------------------------------------------

export function getSkills() { return store().skills; }

// ---- Skill Toggle ----------------------------------------------------------

export function toggleSkill(id: string): boolean {
  const s = store().skills.find((x) => x.id === id);
  if (!s) return false;
  s.enabled = !s.enabled;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'skill.toggle', id, name: s.name, enabled: s.enabled } });
  return true;
}

// ---- CRUD: Skills -----------------------------------------------------------

export function createSkill(data: Omit<Skill, 'id'>): Skill {
  const s = store();
  const id = `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const skill: Skill = { id, ...data };
  s.skills.push(skill);
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'create.skill', id, name: data.name } });
  return skill;
}

export function updateSkill(id: string, data: Partial<Skill>): Skill | null {
  const s = store();
  const existing = s.skills.find((sk) => sk.id === id);
  if (!existing) return null;
  const merged: Skill = {
    id: existing.id,
    name: data.name ?? existing.name,
    category: data.category ?? existing.category,
    version: data.version ?? existing.version,
    enabled: data.enabled ?? existing.enabled,
    description: data.description ?? existing.description,
    config: data.config ?? existing.config,
  };
  const idx = s.skills.indexOf(existing);
  s.skills[idx] = merged;
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'update.skill', id } });
  return merged;
}

export function deleteSkill(id: string): boolean {
  const s = store();
  const idx = s.skills.findIndex((sk) => sk.id === id);
  if (idx === -1) return false;
  s.skills.splice(idx, 1);
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'delete.skill', id } });
  return true;
}
