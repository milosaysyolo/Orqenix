// SPDX-License-Identifier: Apache-2.0

import { eventBus } from '../event-bus';
import { store } from './memory';
import type { Session, TeamNode, TeamEdge, SubagentDef, SubagentHarnessData, SubagentInvocationRecord, SandboxPlugin, AgentDefinition, SyncResult, SyncMode, SyncConflict, MCPDefinition, BindingDefinition, BindingPlatform } from './memory';

// ---- READS -----------------------------------------------------------------

export function getTeam() { return store().team; }
export function getSessions() { return store().sessions; }

// ── Session lifecycle (matches orqenix_report_session_start/resume/promote) ──
export function startSession(agentName: string, agentPlatform: string, parentSessionId?: string): Session {
  const s = store();
  const id = `sess_${Date.now().toString(36)}`;
  const sess: Session = {
    session_id: id, agent_name: agentName, state: 'running',
    started_at: new Date().toISOString(), progress: 0,
    agent_platform: agentPlatform, parent_session_id: parentSessionId, promoted_entries: 0,
  };
  s.sessions.unshift(sess);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.start', id, agentName, agentPlatform } });
  return sess;
}

export function resumeSession(id: string): boolean {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess || sess.state !== 'paused') return false;
  sess.state = 'running';
  sess.paused_at = undefined;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.resume', id } });
  return true;
}

export function pauseSession(id: string): boolean {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess || sess.state !== 'running') return false;
  sess.state = 'paused';
  sess.paused_at = new Date().toISOString();
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.pause', id } });
  return true;
}

export function abortSession(id: string): boolean {
  const s = store();
  const idx = s.sessions.findIndex((x) => x.session_id === id);
  if (idx < 0) return false;
  s.sessions.splice(idx, 1);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.abort', id } });
  return true;
}

export function promoteSessionMemory(id: string): number {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess) return 0;
  const promoted = Math.floor(Math.random() * 3) + 1;
  sess.promoted_entries = (sess.promoted_entries ?? 0) + promoted;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.promote', id, promoted } });
  return promoted;
}

export function getSubagents() { return store().subagents; }
export function getSubagentHarnesses() { return store().subagentHarnesses; }
export function getSubagentInvocations() { return store().subagentInvocations; }
export function getSandboxPlugins() { return store().sandboxPlugins; }
export function getMCPServers() { return store().mcpServers; }
export function getBindings() { return store().bindings; }

export function saveTeam(patch: { nodes: TeamNode[]; edges: TeamEdge[] }) {
  store().team = patch;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'team.save', nodes: patch.nodes.length, edges: patch.edges.length } });
  return true;
}

// ── SyncEngine (simulated) ───────────────────────────────────────────────────

export function getSyncResults(): SyncResult[] { return store().syncResults; }

export function runSync(mode: SyncMode, teamId = 'orqenix-main'): SyncResult {
  const s = store();
  const agentNodes = s.team.nodes.filter((n) => n.type === 'agent' || n.type === 'subagent');
  const written: string[] = [];
  const skipped: string[] = [];
  const drift: { agent: string; description: string }[] = [];
  const conflicts: SyncConflict[] = [];

  for (const node of agentNodes) {
    const filename = `.opencode/agents/${teamId}-${node.name}.md`;
    const r = (node.id.length + node.name.length) % 4;
    if (node.id === 'lead') {
      conflicts.push({
        agent: node.name,
        sourceHash: 'b3f' + Math.random().toString(16).slice(2, 8),
        outputHash: 'a1c' + Math.random().toString(16).slice(2, 8),
        resolution: 'orqenix-wins',
      });
    } else if (r === 0) {
      drift.push({ agent: node.name, description: 'External edit detected in output file — content hash mismatched' });
    } else if (mode === 'verify') {
      skipped.push(filename);
    } else {
      written.push(filename);
    }
  }

  const status: SyncResult['status'] = conflicts.length ? 'conflicts' : drift.length ? 'drift-detected' : 'success';
  const result: SyncResult = { timestamp: new Date().toISOString(), teamId, mode, written, skipped, drift, conflicts, status };
  s.syncResults.unshift(result);
  if (s.syncResults.length > 12) s.syncResults.length = 12;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'team.sync', mode, status, count: written.length } });
  return result;
}

export function setBindingState(platform: string, state: BindingDefinition['state'], configPath?: string) {
  const s = store();
  const existing = s.bindings.find((b) => b.platform === platform);
  if (existing) {
    existing.state = state;
    if (configPath !== undefined) existing.configPath = configPath;
  } else {
    s.bindings.push({ platform: platform as BindingPlatform, state, configPath });
  }
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'binding.' + state, platform } });
  return true;
}

// ---- Subagent Spawn --------------------------------------------------------

export function spawnSubagent(subagentId: string): SubagentInvocationRecord | null {
  const s = store();
  const sub = s.subagents.find((x) => x.id === subagentId);
  if (!sub) return null;
  const stepsTaken = Math.floor(Math.random() * 8) + 1;
  const wallTimeMs = Math.floor(Math.random() * 60000) + 5000;
  const t1 = `t1_${Math.floor(Math.random() * 900) + 100}`;
  const t2 = `t2_${Math.floor(Math.random() * 900) + 100}`;
  const inv: SubagentInvocationRecord = {
    id: `inv_${Date.now().toString(36)}`,
    subagentId,
    subagentKind: sub.name,
    parentSessionId: 'sess_501',
    invokedAt: new Date().toISOString(),
    status: 'success',
    wallTimeMs,
    stepsTaken,
    t1EntryId: t1,
    t2EntryId: t2,
    returnData: { output: { summary: `Completed ${stepsTaken} steps` }, outputMatchesSchema: true },
    absorbResult: { t1EntryId: t1, t2EntryId: t2 },
  };
  s.subagentInvocations.push(inv);
  sub.tasksCompleted += 1;
  sub.status = 'running';
  eventBus.emit({ kind: 'subagent.spawned', actor: sub.name, payload: { subagentId, invocationId: inv.id } });
  return inv;
}

export function setSubagentStatus(id: string, status: SubagentDef['status']) {
  const sub = store().subagents.find((x) => x.id === id);
  if (!sub) return false;
  sub.status = status;
  eventBus.emit({ kind: 'subagent.returned', actor: sub.name, payload: { subagentId: id, status } });
  return true;
}

// ---- CRUD: Subagents --------------------------------------------------------

export function createSubagent(data: Omit<SubagentDef, 'id'>): SubagentDef {
  const s = store();
  const id = `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const agent: SubagentDef = { id, ...data };
  s.subagents.push(agent);
  eventBus.emit({ kind: 'subagent.spawned', actor: 'system', payload: { op: 'create', id, name: data.name } });
  return agent;
}

export function updateSubagent(id: string, data: Partial<SubagentDef>): SubagentDef | null {
  const s = store();
  const existing = s.subagents.find((a) => a.id === id);
  if (!existing) return null;
  const merged: SubagentDef = {
    id: existing.id,
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    status: data.status ?? existing.status,
    uptime: data.uptime ?? existing.uptime,
    tasksCompleted: data.tasksCompleted ?? existing.tasksCompleted,
    config: data.config ?? existing.config,
  };
  const idx = s.subagents.indexOf(existing);
  s.subagents[idx] = merged;
  eventBus.emit({ kind: 'subagent.returned', actor: 'system', payload: { op: 'update', id } });
  return merged;
}

export function deleteSubagent(id: string): boolean {
  const s = store();
  const idx = s.subagents.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  s.subagents.splice(idx, 1);
  eventBus.emit({ kind: 'subagent.returned', actor: 'system', payload: { op: 'delete', id } });
  return true;
}

// ---- Agent Configs -----------------------------------------------------------

export function getAgentConfig(agentId: string): string {
  return store().agentConfigs[agentId] ?? '';
}

export function setAgentConfig(agentId: string, config: string): void {
  store().agentConfigs[agentId] = config;
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'agent.config.update', agentId } });
}
