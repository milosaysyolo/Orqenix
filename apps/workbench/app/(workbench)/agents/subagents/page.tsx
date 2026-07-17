// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENTS / SUBAGENTS PAGE — Definition & configuration page aligned with
// Orqenix reality. Agents are defined via YAML frontmatter + markdown body
// (matching AgentFile from @orqenix/core). Subagents use SubagentHarnessManager
// lifecycle (validate → run → absorb) from @orqenix/memory-engine.
//
// Tab 1: Agents — primary agent definitions (team nodes type=agent)
// Tab 2: Subagents — subagent definitions with harness lifecycle
// ============================================================================

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { CollapseToggle } from '@/components/collapse-toggle';
import { ConfigEditor } from '@/components/config-editor';
import { Modal } from '@/components/modal';
import { TabbedForm } from '@/components/tabbed-form';
import { SubagentDetail } from '@/components/agents/subagent-detail';
import { SubagentList } from '@/components/agents/SubagentList';
import { SubagentForm } from '@/components/agents/SubagentForm';
import { useSubagentForm } from '@/lib/use-subagent-form';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import type {
  TeamNode, TeamEdge, SubagentDef, SubagentHarnessData,
  SubagentInvocationRecord,
} from '@/lib/demo-store';

type SortKey = 'name' | 'tasks';

// ─── Agent Config Parser (YAML frontmatter + markdown body) ─────────────────
// Parses AgentFile format from @orqenix/core

// Parsed representation of an AgentFile (all 25 fields of the real format)
interface ParsedAgentConfig {
  mode: string; model: string; temperature: number; description: string;
  tools: Record<string, boolean>; maxSteps: number;
  team: string; role: string; isTeamLead: boolean; costBudgetTokens: number;
  // 11 extended fields
  permission: Record<string, string>;
  prompt: string;
  disable: boolean;
  knowledge_briefing: boolean;
  briefing_kbs: string[];
  briefing_max_tokens: number;
  capture_decisions: boolean;
  reindex_after: string;
  writes: string[];
  lazyAgents: string[];
  fallback_model: string;
  body: string;
}

function parseAgentConfig(config: string): ParsedAgentConfig {
  const fm: Record<string, unknown> = {};
  const fmMatch = config.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const lines = (fmMatch[1] ?? '').split('\n');
    let currentKey = '';
    for (const line of lines) {
      const kv = line.match(/^(\w+):\s*(.+)/);
      if (kv && kv[1] && kv[2]) { currentKey = kv[1]; fm[currentKey] = kv[2].replace(/^["']|["']$/g, ''); }
      else if (currentKey === 'tools' && line.match(/^\s+(\w+):\s*(true|false)/)) {
        const tm = line.match(/^\s+(\w+):\s*(true|false)/);
        if (tm && tm[1] && tm[2]) {
          if (!fm.tools || typeof fm.tools !== 'object') fm.tools = {};
          (fm.tools as Record<string, boolean>)[tm[1]] = tm[2] === 'true';
        }
      } else if (currentKey === 'orqenix' && line.match(/^\s+(\w+):\s*(.+)/)) {
        const om = line.match(/^\s+(\w+):\s*(.+)/);
        if (om && om[1] && om[2]) fm[`orqenix_${om[1]}`] = om[2].replace(/^["']|["']$/g, '');
      }
    }
  }
  const body = fmMatch ? config.slice(fmMatch[0].length).trim() : config;
  const parseList = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  };
  const parseMap = (v: unknown): Record<string, string> => {
    if (v && typeof v === 'object') return v as Record<string, string>;
    return {};
  };
  return {
    mode: String(fm.mode ?? 'primary'),
    model: String(fm.model ?? 'anthropic/claude-sonnet-4-20250514'),
    temperature: Number(fm.temperature ?? 0.3),
    description: String(fm.description ?? ''),
    tools: (fm.tools as Record<string, boolean>) ?? {},
    maxSteps: Number(fm.maxSteps ?? 10),
    team: String(fm.orqenix_team ?? ''),
    role: String(fm.orqenix_role ?? ''),
    isTeamLead: fm.orqenix_isTeamLead === 'true',
    costBudgetTokens: Number(fm.orqenix_costBudgetTokens ?? 50000),
    // 11 extended fields
    permission: parseMap(fm.permission),
    prompt: String(fm.prompt ?? ''),
    disable: fm.disable === 'true',
    knowledge_briefing: fm.orqenix_knowledge_briefing === 'true',
    briefing_kbs: parseList(fm.orqenix_briefing_kbs),
    briefing_max_tokens: Number(fm.orqenix_briefing_max_tokens ?? 2000),
    capture_decisions: fm.orqenix_capture_decisions === 'true',
    reindex_after: String(fm.orqenix_reindex_after ?? 'auto'),
    writes: parseList(fm.orqenix_writes),
    lazyAgents: parseList(fm.orqenix_lazyAgents),
    fallback_model: String(fm.orqenix_fallback_model ?? ''),
    body,
  };
}

function buildAgentConfigMd(name: string, opts: ParsedAgentConfig): string {
  const toolLines = Object.entries(opts.tools).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  const orqLines = [
    opts.team && `  team: ${opts.team}`,
    opts.role && `  role: ${opts.role}`,
    `  isTeamLead: ${opts.isTeamLead}`,
    `  costBudgetTokens: ${opts.costBudgetTokens}`,
    `  knowledge_briefing: ${opts.knowledge_briefing}`,
    opts.briefing_kbs.length && `  briefing_kbs: [${opts.briefing_kbs.map((k) => `"${k}"`).join(', ')}]`,
    `  briefing_max_tokens: ${opts.briefing_max_tokens}`,
    `  capture_decisions: ${opts.capture_decisions}`,
    `  reindex_after: ${opts.reindex_after}`,
    opts.writes.length && `  writes: [${opts.writes.map((k) => `"${k}"`).join(', ')}]`,
    opts.lazyAgents.length && `  lazyAgents: [${opts.lazyAgents.map((k) => `"${k}"`).join(', ')}]`,
    opts.fallback_model && `  fallback_model: "${opts.fallback_model}"`,
  ].filter(Boolean).join('\n');
  const permLines = Object.entries(opts.permission)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');
  return `---
description: "${opts.description || `${name} agent`}"
mode: ${opts.mode}
model: "${opts.model}"
temperature: ${opts.temperature}
maxSteps: ${opts.maxSteps}
${permLines ? `permission:\n${permLines}\n` : ''}prompt: "${opts.prompt || ''}"
disable: ${opts.disable}
tools:
${toolLines || '  read_memory: true'}
orqenix:
${orqLines || '  team: main-team'}
---

${opts.body || `${name} agent body content.`}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<'agents' | 'subagents'>('agents');

  // ── Data ────────────────────────────────────────────────────────────────
  const [teamNodes, setTeamNodes] = React.useState<TeamNode[]>([]);
  const [teamEdges, setTeamEdges] = React.useState<TeamEdge[]>([]);
  const [agentsLoading, setAgentsLoading] = React.useState(true);
  const [subagents, setSubagents] = React.useState<SubagentDef[]>([]);
  const [harnesses, setHarnesses] = React.useState<SubagentHarnessData[]>([]);
  const [invocations, setInvocations] = React.useState<SubagentInvocationRecord[]>([]);
  const [agentConfigs, setAgentConfigs] = React.useState<Record<string, string>>({});

  // ── Filters ─────────────────────────────────────────────────────────────
  const [agentQuery, setAgentQuery] = React.useState('');
  const [agentSort, setAgentSort] = React.useState<SortKey>('name');
  const [saQuery, setSaQuery] = React.useState('');
  const [saSort, setSaSort] = React.useState<SortKey>('name');

  // ── Selection ───────────────────────────────────────────────────────────
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(true);
  const [agentConfig, setAgentConfig] = React.useState('');
  const [agentConfigLoading, setAgentConfigLoading] = React.useState(false);

  // ── CRUD ────────────────────────────────────────────────────────────────
  const [showAgentForm, setShowAgentForm] = React.useState(false);
  const [editAgent, setEditAgent] = React.useState<TeamNode | null>(null);
  const [showSubagentForm, setShowSubagentForm] = React.useState(false);
  const [editSubagent, setEditSubagent] = React.useState<SubagentDef | null>(null);
  const [busyCrud, setBusyCrud] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // ── Agent form fields ───────────────────────────────────────────────────
  const [agentName, setAgentName] = React.useState('');
  const [agentRole, setAgentRole] = React.useState('');
  const [agentMode, setAgentMode] = React.useState('primary');
  const [agentDescription, setAgentDescription] = React.useState('');
  const [agentModel, setAgentModel] = React.useState('anthropic/claude-sonnet-4-20250514');
  const [agentTemperature, setAgentTemperature] = React.useState('0.3');
  const [agentMaxSteps, setAgentMaxSteps] = React.useState('10');
  const [agentCostBudget, setAgentCostBudget] = React.useState('50000');
  const [agentTools, setAgentTools] = React.useState('read_memory,search_code');
  const [agentConfigRaw, setAgentConfigRaw] = React.useState('');

  // ── Agent extended fields (Phase 1: 11 missing AgentFile fields) ─────────
  const [agentTeam, setAgentTeam] = React.useState('main-team');
  const [agentIsTeamLead, setAgentIsTeamLead] = React.useState(false);
  const [agentManagesAgents, setAgentManagesAgents] = React.useState('');
  const [agentProtectContext, setAgentProtectContext] = React.useState(false);
  const [agentPermission, setAgentPermission] = React.useState(''); // "op: allow, op2: ask" format
  const [agentPrompt, setAgentPrompt] = React.useState('');
  const [agentDisable, setAgentDisable] = React.useState(false);
  const [agentKnowledgeBriefing, setAgentKnowledgeBriefing] = React.useState(false);
  const [agentBriefingKbs, setAgentBriefingKbs] = React.useState<string[]>([]);
  const [agentBriefingMaxTokens, setAgentBriefingMaxTokens] = React.useState('2000');
  const [agentCaptureDecisions, setAgentCaptureDecisions] = React.useState(false);
  const [agentReindexAfter, setAgentReindexAfter] = React.useState('auto');
  const [agentWrites, setAgentWrites] = React.useState<string[]>([]);
  const [agentLazyAgents, setAgentLazyAgents] = React.useState('');
  const [agentFallbackModel, setAgentFallbackModel] = React.useState('');

  // ── Subagent form (consolidated hook) ─────────────────────────────────
  const saForm = useSubagentForm();

  // ── Load data ───────────────────────────────────────────────────────────
  const loadAll = React.useCallback(async () => {
    const [teamRes, subRes, harRes, invRes] = await Promise.all([
      api.get<{ nodes: TeamNode[]; edges: TeamEdge[] }>('/api/agents/teams'),
      api.get<{ subagents: SubagentDef[] }>('/api/agents/subagents'),
      api.get<{ harnesses: SubagentHarnessData[] }>('/api/agents/subagents/harnesses'),
      api.get<{ invocations: SubagentInvocationRecord[] }>('/api/agents/subagents/invocations'),
    ]);
    if (teamRes.ok) {
      setTeamNodes(teamRes.data!.nodes);
      setTeamEdges(teamRes.data!.edges);
      const configs: Record<string, string> = {};
      await Promise.all(teamRes.data!.nodes.map(async (n) => {
        const res = await api.get<{ config: string }>(`/api/agents/teams/${n.id}/config`);
        if (res.ok) configs[n.id] = res.data?.config ?? '';
      }));
      setAgentConfigs(configs);
    }
    if (subRes.ok) setSubagents(subRes.data!.subagents);
    if (harRes.ok) setHarnesses(harRes.data!.harnesses);
    if (invRes.ok) setInvocations(invRes.data!.invocations);
    setAgentsLoading(false);
  }, []);

  React.useEffect(() => { void loadAll(); }, [loadAll]);
  const { latest: liveEvent } = useLiveEvents(['subagent.spawned', 'subagent.returned', 'session.updated']);
  React.useEffect(() => { if (liveEvent) void loadAll(); }, [liveEvent, loadAll]);

  // ── Selected items ──────────────────────────────────────────────────────
  const selectedSub = subagents.find((s) => s.id === selectedId) ?? null;
  const selectedHarness = selectedSub ? harnesses.find((h) => h.subagentKind === selectedSub.name) ?? null : null;
  const selectedAgentNode = teamNodes.find((n) => n.id === selectedAgentId) ?? null;

  // Load agent config
  React.useEffect(() => {
    if (selectedAgentId && tab === 'agents') {
      setAgentConfigLoading(true);
      api.get<{ config: string }>(`/api/agents/teams/${selectedAgentId}/config`).then((res) => {
        if (res.ok) setAgentConfig(res.data?.config ?? '');
        setAgentConfigLoading(false);
      });
    }
  }, [selectedAgentId, tab]);

  // Agent stats
  const agentStats = React.useMemo(() => {
    const stats: Record<string, { subagentCount: number; edgeCount: number; parsed: ReturnType<typeof parseAgentConfig> }> = {};
    for (const node of teamNodes) {
      const edges = teamEdges.filter((e) => e.from === node.id || e.to === node.id);
      const subs = edges.filter((e) => {
        const otherId = e.from === node.id ? e.to : e.from;
        return teamNodes.find((n) => n.id === otherId)?.type === 'subagent';
      }).length;
      const cfg = agentConfigs[node.id] ?? '';
      stats[node.id] = { subagentCount: subs, edgeCount: edges.length, parsed: parseAgentConfig(cfg) };
    }
    return stats;
  }, [teamNodes, teamEdges, agentConfigs]);

  // ── Filtered lists ──────────────────────────────────────────────────────
  const filteredAgents = React.useMemo(() => {
    let list = teamNodes.filter((n) => n.type === 'agent');
    if (agentQuery) { const q = agentQuery.toLowerCase(); list = list.filter((n) => n.name.toLowerCase().includes(q)); }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [teamNodes, agentQuery]);

  const filteredSubagents = React.useMemo(() => {
    let list = subagents;
    if (saQuery) { const q = saQuery.toLowerCase(); list = list.filter((s) => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q)); }
    return [...list].sort((a, b) => {
      if (saSort === 'name') return a.name.localeCompare(b.name);
      return b.tasksCompleted - a.tasksCompleted;
    });
  }, [subagents, saQuery, saSort]);

  // ── Agent CRUD ──────────────────────────────────────────────────────────
  function openNewAgent() {
    setEditAgent(null);
    setAgentName(''); setAgentRole(''); setAgentMode('primary'); setAgentDescription('');
    setAgentModel('anthropic/claude-sonnet-4-20250514'); setAgentTemperature('0.3');
    setAgentMaxSteps('10'); setAgentCostBudget('50000'); setAgentTools('read_memory,search_code');
    setAgentTeam('main-team'); setAgentIsTeamLead(false); setAgentManagesAgents(''); setAgentProtectContext(false);
    setAgentPermission(''); setAgentPrompt(''); setAgentDisable(false);
    setAgentKnowledgeBriefing(false); setAgentBriefingKbs([]); setAgentBriefingMaxTokens('2000');
    setAgentCaptureDecisions(false); setAgentReindexAfter('auto'); setAgentWrites([]); setAgentLazyAgents(''); setAgentFallbackModel('');
    setAgentConfigRaw('');
    setShowAgentForm(true);
  }

  function openEditAgent(node: TeamNode) {
    setEditAgent(node);
    setAgentName(node.name);
    api.get<{ config: string }>(`/api/agents/teams/${node.id}/config`).then((res) => {
      const cfg = res.ok ? (res.data?.config ?? '') : '';
      const p = parseAgentConfig(cfg);
      setAgentRole(p.role); setAgentMode(p.mode); setAgentDescription(p.description);
      setAgentModel(p.model); setAgentTemperature(String(p.temperature));
      setAgentMaxSteps(String(p.maxSteps)); setAgentCostBudget(String(p.costBudgetTokens));
      setAgentTools(Object.keys(p.tools).filter((k) => p.tools[k]).join(','));
      setAgentTeam(p.team); setAgentIsTeamLead(p.isTeamLead);
      setAgentManagesAgents(''); setAgentProtectContext(false);
      setAgentPermission(Object.entries(p.permission).map(([k, v]) => `${k}: ${v}`).join(', '));
      setAgentPrompt(p.prompt); setAgentDisable(p.disable);
      setAgentKnowledgeBriefing(p.knowledge_briefing); setAgentBriefingKbs(p.briefing_kbs);
      setAgentBriefingMaxTokens(String(p.briefing_max_tokens)); setAgentCaptureDecisions(p.capture_decisions);
      setAgentReindexAfter(p.reindex_after); setAgentWrites(p.writes); setAgentLazyAgents(p.lazyAgents.join(', '));
      setAgentFallbackModel(p.fallback_model);
      setAgentConfigRaw(cfg);
    });
    setShowAgentForm(true);
  }

  async function saveAgent() {
    if (!agentName.trim()) { toast({ tone: 'error', title: 'Validation', message: 'Name is required' }); return; }
    setBusyCrud(true);
    const newId = `node_${Date.now().toString(36)}`;
    let updated: TeamNode[];
    if (editAgent) {
      updated = teamNodes.map((n) => n.id === editAgent.id ? { ...n, name: agentName.trim() } : n);
    } else {
      updated = [...teamNodes, { id: newId, name: agentName.trim(), type: 'agent', x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 }];
    }
    const res = await api.post('/api/agents/teams', { nodes: updated, edges: teamEdges });
    if (res.ok) {
      const agentId = editAgent?.id ?? newId;
      const toolsMap: Record<string, boolean> = {};
      agentTools.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => { toolsMap[t] = true; });
      const permissionMap: Record<string, string> = {};
      agentPermission.split(',').map((t) => t.trim()).filter(Boolean).forEach((pair) => {
        const [k, v] = pair.split(':').map((x) => x.trim());
        if (k && v) permissionMap[k] = v;
      });
      const configMd = agentConfigRaw.trim() || buildAgentConfigMd(agentName.trim(), {
        mode: agentMode, model: agentModel, temperature: Number(agentTemperature),
        description: agentDescription, tools: toolsMap, maxSteps: Number(agentMaxSteps),
        team: agentTeam, role: agentRole, isTeamLead: agentIsTeamLead,
        costBudgetTokens: Number(agentCostBudget),
        permission: permissionMap,
        prompt: agentPrompt, disable: agentDisable,
        knowledge_briefing: agentKnowledgeBriefing, briefing_kbs: agentBriefingKbs,
        briefing_max_tokens: Number(agentBriefingMaxTokens), capture_decisions: agentCaptureDecisions,
        reindex_after: agentReindexAfter, writes: agentWrites, lazyAgents: agentLazyAgents.split(',').map((s) => s.trim()).filter(Boolean),
        fallback_model: agentFallbackModel, body: '',
      });
      await api.put(`/api/agents/teams/${agentId}/config`, { config: configMd });
      setTeamNodes(updated);
      toast({ tone: 'success', title: editAgent ? 'Updated' : 'Created', message: `Agent ${agentName.trim()}` });
      setShowAgentForm(false);
    } else { toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' }); }
    setBusyCrud(false);
  }

  async function deleteAgent(id: string) {
    setBusyCrud(true);
    const updated = teamNodes.filter((n) => n.id !== id);
    const updatedEdges = teamEdges.filter((e) => e.from !== id && e.to !== id);
    const res = await api.post('/api/agents/teams', { nodes: updated, edges: updatedEdges });
    setBusyCrud(false);
    if (res.ok) { setTeamNodes(updated); setTeamEdges(updatedEdges); if (selectedAgentId === id) setSelectedAgentId(null); toast({ tone: 'info', title: 'Deleted', message: 'Agent removed' }); setDeleteConfirm(null); }
    else { toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' }); }
  }

  // ── Subagent CRUD ───────────────────────────────────────────────────────
  function openNewSubagent() {
    setEditSubagent(null);
    saForm.reset();
    setShowSubagentForm(true);
  }

  function openEditSubagent(sa: SubagentDef) {
    setEditSubagent(sa);
    const harness = harnesses.find((h) => h.subagentKind === sa.name);
    saForm.reset({
      name: sa.name,
      role: sa.role,
      kind: harness?.subagentKind ?? '',
      systemPrompt: harness?.systemPrompt ?? '',
      goal: harness?.goal ?? '',
      maxSteps: String(harness?.constraints.maxSteps ?? '5'),
      maxTime: String(harness?.constraints.maxWallTimeSec ?? '90'),
      allowedTools: harness?.constraints.allowedTools.join(',') ?? '',
      forbiddenTools: harness?.constraints.forbiddenTools.join(',') ?? 'write_file,git_commit',
      configRaw: sa.config ?? '',
    });
    setShowSubagentForm(true);
  }

  async function saveSubagent() {
    const { name, role, systemPrompt, goal, maxSteps, maxTime, allowedTools, forbiddenTools, configRaw } = saForm.form;
    if (!name.trim()) { toast({ tone: 'error', title: 'Validation', message: 'Name is required' }); return; }
    setBusyCrud(true);
    const configMd = configRaw.trim() || `# ${name.trim()}\n\nagent type: sub agent\n\n## System Prompt\n${systemPrompt || 'No system prompt configured.'}\n\n## Goal\n${goal || 'No goal configured.'}\n\n## Constraints\n- Max steps: ${maxSteps}\n- Max wall time: ${maxTime}s\n- Allowed tools: ${allowedTools || 'none'}\n- Forbidden tools: ${forbiddenTools || 'none'}\n`;
    if (editSubagent) {
      const res = await api.put(`/api/agents/subagents/${editSubagent.id}`, { name: name.trim(), role: role.trim(), config: configMd });
      if (res.ok) { setSubagents((prev) => prev.map((s) => s.id === editSubagent.id ? { ...s, name: name.trim(), role: role.trim(), config: configMd } : s)); toast({ tone: 'success', title: 'Updated', message: `Subagent ${name.trim()}` }); setShowSubagentForm(false); }
      else { toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' }); }
    } else {
      const res = await api.post<{ subagent: SubagentDef }>('/api/agents/subagents', { name: name.trim(), role: role.trim(), status: 'idle', uptime: '0m', tasksCompleted: 0, config: configMd });
      if (res.ok && res.data) { setSubagents((prev) => [...prev, res.data!.subagent]); toast({ tone: 'success', title: 'Created', message: `Subagent ${name.trim()}` }); setShowSubagentForm(false); }
      else { toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' }); }
    }
    setBusyCrud(false);
  }

  async function deleteSubagent(id: string) {
    setBusyCrud(true);
    const res = await api.del(`/api/agents/subagents/${id}`);
    setBusyCrud(false);
    if (res.ok) { setSubagents((prev) => prev.filter((s) => s.id !== id)); if (selectedId === id) setSelectedId(null); toast({ tone: 'info', title: 'Deleted', message: 'Subagent removed' }); setDeleteConfirm(null); }
    else { toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' }); }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Define and configure agents and subagents">Agents</SectionTitle>
        <div className="flex items-center gap-2">
          {tab === 'agents' && <Button variant="primary" size="sm" onClick={openNewAgent}>+ New Agent</Button>}
          {tab === 'subagents' && <Button variant="primary" size="sm" onClick={openNewSubagent}>+ New Subagent</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-[9px] bg-[var(--paper2)] p-0.5 w-fit">
        <button onClick={() => { setTab('agents'); setSelectedId(null); setSelectedAgentId(null); }}
          className={`rounded-[7px] px-4 py-1.5 font-mono text-[11px] font-semibold transition-colors ${tab === 'agents' ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm' : 'text-[var(--dim)] hover:text-[var(--ink)]'}`}>
          Agents ({teamNodes.filter((n) => n.type === 'agent').length})
        </button>
        <button onClick={() => { setTab('subagents'); setSelectedAgentId(null); }}
          className={`rounded-[7px] px-4 py-1.5 font-mono text-[11px] font-semibold transition-colors ${tab === 'subagents' ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm' : 'text-[var(--dim)] hover:text-[var(--ink)]'}`}>
          Subagents ({subagents.length})
        </button>
      </div>

      <div className="mt-4 flex gap-5">
        {/* ─── List ─────────────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {tab === 'agents' && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--faint)]">{'\u2315'}</span>
                  <input value={agentQuery} onChange={(e) => setAgentQuery(e.target.value)} placeholder="Search agents\u2026"
                    className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-8 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
                </div>
                <select value={agentSort} onChange={(e) => setAgentSort(e.target.value as SortKey)}
                  className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 font-mono text-[10px] text-[var(--ink)] outline-none">
                  <option value="name">Name</option>
                </select>
              </div>
              {agentsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse"><div className="h-4 w-4 rounded-full bg-[var(--line)]" /><div className="h-3 w-32 rounded bg-[var(--line)]" /></Card>)}</div>
              ) : filteredAgents.length === 0 ? (
                <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">{agentQuery ? 'No agents match your search.' : 'No agents defined.'}</Card>
              ) : (
                <div className="space-y-2">
                  {filteredAgents.map((node) => {
                    const st = agentStats[node.id];
                    const parsed = st?.parsed;
                    return (
                      <Card key={node.id}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--rust)] ${selectedAgentId === node.id ? 'border-[var(--rust)]' : ''}`}
                        onClick={() => setSelectedAgentId(node.id)}>
                        <span className="font-mono text-[15px] text-[var(--rust)]">{'\u25C7'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{node.name}</span>
                            <span className="rounded-full bg-[var(--plum-light)] px-2 py-0.5 font-mono text-[9px] text-[var(--plum)]">{parsed?.mode ?? 'primary'}</span>
                            {parsed?.model && (
                              <span className="rounded-full bg-[color-mix(in_oklab,var(--teal)_12%,transparent)] px-2 py-0.5 font-mono text-[9px] text-[var(--teal)]">{parsed.model.split('/').pop()}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 font-mono text-[9.5px] text-[var(--faint)]">
                            {parsed?.role && <span>{parsed.role}</span>}
                            {st && st.subagentCount > 0 && <span>{st.subagentCount} subagents</span>}
                            {st && st.edgeCount > 0 && <span>{st.edgeCount} edges</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); openEditAgent(node); }}
                            className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 font-mono text-[9px] text-[var(--dim)] hover:text-[var(--ink)]">Edit</button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(node.id); }}
                            className="rounded-[6px] border border-[var(--rust)] px-2 py-0.5 font-mono text-[9px] text-[var(--rust)]">Del</button>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--faint)]">{'\u203A'}</span>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'subagents' && (
            <SubagentList
              subagents={filteredSubagents}
              saQuery={saQuery}
              onSaQueryChange={setSaQuery}
              saSort={saSort}
              onSaSortChange={(v: 'name' | 'tasks') => setSaSort(v)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              harnesses={harnesses}
              teamNodes={teamNodes}
              onEdit={openEditSubagent}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          )}
        </div>

        {/* ─── Detail Panel ──────────────────────────────────────────────────── */}
        <div className="hidden lg:block relative shrink-0 transition-all duration-200" style={{ width: detailOpen ? 420 : 44 }}>
          <div className="overflow-hidden transition-all duration-200" style={{ width: detailOpen ? 420 : 0, opacity: detailOpen ? 1 : 0 }}>
            {tab === 'agents' && selectedAgentNode ? (
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{selectedAgentNode.name}</span>
                    {agentStats[selectedAgentNode.id]?.parsed && (() => {
                      const p = agentStats[selectedAgentNode.id]!.parsed;
                      return (
                        <>
                          <span className="rounded-full bg-[var(--plum-light)] px-2 py-0.5 font-mono text-[9px] text-[var(--plum)]">{p.mode}</span>
                          {p.model && <span className="rounded-full bg-[color-mix(in_oklab,var(--teal)_12%,transparent)] px-2 py-0.5 font-mono text-[9px] text-[var(--teal)]">{p.model.split('/').pop()}</span>}
                        </>
                      );
                    })()}
                  </div>
                  <button onClick={() => setSelectedAgentId(null)} className="font-mono text-[14px] text-[var(--faint)] hover:text-[var(--ink)]">{'\u00D7'}</button>
                </div>
                {agentStats[selectedAgentNode.id] && (() => {
                  const st = agentStats[selectedAgentNode.id]!;
                  return (st.subagentCount > 0 || st.edgeCount > 0) && (
                    <div className="flex gap-3 font-mono text-[10px] text-[var(--faint)]">
                      {st.subagentCount > 0 && <span>{st.subagentCount} subagents</span>}
                      {st.edgeCount > 0 && <span>{st.edgeCount} edges</span>}
                    </div>
                  );
                })()}
                <div>
                  <div className="font-mono text-[10px] font-bold text-[var(--dim)] mb-1">Config (Markdown)</div>
                  {agentConfigLoading ? (
                    <div className="h-[300px] rounded-[7px] bg-[var(--line)] animate-pulse" />
                  ) : (
                    <ConfigEditor value={agentConfig} onChange={(val) => { setAgentConfig(val); void api.put(`/api/agents/teams/${selectedAgentId}/config`, { config: val }); }} language="markdown" height={300} />
                  )}
                </div>
              </Card>
            ) : tab === 'subagents' && selectedSub ? (
              <SubagentDetail
                subagent={selectedSub}
                harness={selectedHarness}
                invocations={invocations}
                onClose={() => setSelectedId(null)}
                onStatusChange={(id, status) => setSubagents((prev) => prev.map((s) => s.id === id ? { ...s, status } : s))}
              />
            ) : (
              <Card className="grid h-[300px] place-items-center p-6 text-center font-mono text-[10.5px] text-[var(--faint)]">
                <div>
                  <div className="text-[24px] text-[var(--plum)] opacity-30">{'\u22C5'}</div>
                  <div className="mt-2">Select an {tab === 'agents' ? 'agent' : 'subagent'} to inspect</div>
                  <div className="mt-1">harness config and config editor</div>
                </div>
              </Card>
            )}
          </div>
          <div className="absolute top-3 z-10 transition-all duration-200"
            style={{ left: -12, opacity: detailOpen ? 1 : 0, pointerEvents: detailOpen ? 'auto' : 'none', transform: detailOpen ? 'scale(1)' : 'scale(0.85)' }}>
            <CollapseToggle collapsed={false} onToggle={() => setDetailOpen(false)} side="right" label="Collapse detail" />
          </div>
          <div className="absolute left-1 top-3 z-10 flex items-center gap-2 transition-all duration-200"
            style={{ opacity: detailOpen ? 0 : 1, pointerEvents: detailOpen ? 'none' : 'auto', transform: detailOpen ? 'translateX(-8px) scale(0.85)' : 'translateX(0) scale(1)' }}>
            <span className="h-px w-3 bg-[var(--line)]" />
            <CollapseToggle collapsed={true} onToggle={() => setDetailOpen(true)} side="right" label="Show detail" />
            <span className="h-px w-3 bg-[var(--line)]" />
          </div>
        </div>
      </div>

      {/* ── Agent Form Modal ──────────────────────────────────────────────── */}
      {showAgentForm && (
        <Modal title={editAgent ? 'Edit Agent' : 'New Agent'} onClose={() => setShowAgentForm(false)} wide>
          <TabbedForm
            tabs={[
              { key: 'identity', label: 'Identity', content: (
                <div className="space-y-3">
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Name *</label>
                    <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Mode</label>
                      <select value={agentMode} onChange={(e) => setAgentMode(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none">
                        <option value="primary">primary</option><option value="subagent">subagent</option><option value="all">all</option>
                      </select></div>
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Role</label>
                      <input value={agentRole} onChange={(e) => setAgentRole(e.target.value)} placeholder="e.g. orchestration"
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  </div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Description</label>
                    <textarea value={agentDescription} onChange={(e) => setAgentDescription(e.target.value)} rows={2}
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none" /></div>
                </div>
              )},
              { key: 'model', label: 'Model', content: (
                <div className="space-y-3">
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Model</label>
                    <select value={agentModel} onChange={(e) => setAgentModel(e.target.value)}
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none">
                      <option value="anthropic/claude-sonnet-4-20250514">claude-sonnet-4</option>
                      <option value="anthropic/claude-opus-4-20250514">claude-opus-4</option>
                      <option value="ollama/qwen2.5-coder">qwen2.5-coder (local)</option>
                    </select></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Temperature</label>
                      <input type="number" step="0.1" min="0" max="1" value={agentTemperature} onChange={(e) => setAgentTemperature(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Max Steps</label>
                      <input type="number" value={agentMaxSteps} onChange={(e) => setAgentMaxSteps(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Cost Budget</label>
                      <input type="number" value={agentCostBudget} onChange={(e) => setAgentCostBudget(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  </div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Tools (comma-separated)</label>
                    <input value={agentTools} onChange={(e) => setAgentTools(e.target.value)} placeholder="read_memory,search_code"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={agentProtectContext} onChange={(e) => setAgentProtectContext(e.target.checked)} />
                    <label className="font-mono text-[10px] text-[var(--ink)]">Protect context (never_compress / never_move_tier)</label>
                  </div>
                </div>
              )},
              { key: 'permissions', label: 'Permissions', content: (
                <div className="space-y-3">
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Permission map (op: allow/ask/deny)</label>
                    <input value={agentPermission} onChange={(e) => setAgentPermission(e.target.value)} placeholder="write_file: ask, git_commit: deny"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">System prompt override</label>
                    <textarea value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} rows={3} placeholder="You are the team lead..."
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none" /></div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={agentDisable} onChange={(e) => setAgentDisable(e.target.checked)} />
                    <label className="font-mono text-[10px] text-[var(--ink)]">Disable this agent</label>
                  </div>
                </div>
              )},
              { key: 'orqenix', label: 'Orqenix', content: (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Team</label>
                      <input value={agentTeam} onChange={(e) => setAgentTeam(e.target.value)} placeholder="main-team"
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Manages Agents</label>
                      <input value={agentManagesAgents} onChange={(e) => setAgentManagesAgents(e.target.value)} placeholder="researcher, coder"
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={agentIsTeamLead} onChange={(e) => setAgentIsTeamLead(e.target.checked)} />
                    <label className="font-mono text-[10px] text-[var(--ink)]">Is team lead</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={agentKnowledgeBriefing} onChange={(e) => setAgentKnowledgeBriefing(e.target.checked)} />
                    <label className="font-mono text-[10px] text-[var(--ink)]">Knowledge briefing</label>
                  </div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Briefing KBs</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(['decisions', 'docs', 'code'] as const).map((kb) => (
                        <label key={kb} className="flex items-center gap-1 font-mono text-[10px]">
                          <input type="checkbox" checked={agentBriefingKbs.includes(kb)} onChange={(e) => setAgentBriefingKbs((prev) => e.target.checked ? [...prev, kb] : prev.filter((x) => x !== kb))} />
                          {kb}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Briefing Max Tokens</label>
                      <input type="number" value={agentBriefingMaxTokens} onChange={(e) => setAgentBriefingMaxTokens(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                    <div><label className="font-mono text-[10px] text-[var(--faint)]">Reindex After</label>
                      <select value={agentReindexAfter} onChange={(e) => setAgentReindexAfter(e.target.value)}
                        className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none">
                        <option value="auto">auto</option><option value="code">code</option><option value="docs">docs</option><option value="both">both</option><option value="none">none</option>
                      </select></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={agentCaptureDecisions} onChange={(e) => setAgentCaptureDecisions(e.target.checked)} />
                    <label className="font-mono text-[10px] text-[var(--ink)]">Capture decisions</label>
                  </div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Writes</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(['code', 'docs', 'tests', 'config'] as const).map((w) => (
                        <label key={w} className="flex items-center gap-1 font-mono text-[10px]">
                          <input type="checkbox" checked={agentWrites.includes(w)} onChange={(e) => setAgentWrites((prev) => e.target.checked ? [...prev, w] : prev.filter((x) => x !== w))} />
                          {w}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Lazy Agents (comma-separated)</label>
                    <input value={agentLazyAgents} onChange={(e) => setAgentLazyAgents(e.target.value)} placeholder="researcher, tester"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                  <div><label className="font-mono text-[10px] text-[var(--faint)]">Fallback Model</label>
                    <input value={agentFallbackModel} onChange={(e) => setAgentFallbackModel(e.target.value)} placeholder="ollama/qwen2.5-coder"
                      className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" /></div>
                </div>
              )},
              { key: 'config', label: 'Config', content: (
                <div>
                  <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">Edit raw markdown config (YAML frontmatter + body)</div>
                  <ConfigEditor value={agentConfigRaw} onChange={setAgentConfigRaw} language="markdown" height={250} />
                </div>
              )},
            ]}
            footer={(
              <div className="flex gap-2 pt-2">
                <Button variant="primary" size="sm" onClick={() => void saveAgent()} disabled={busyCrud}>{busyCrud ? '\u2026' : editAgent ? 'Save Changes' : 'Create Agent'}</Button>
                <Button variant="outline" size="sm" onClick={() => setShowAgentForm(false)}>Cancel</Button>
              </div>
            )}
          />
        </Modal>
      )}

      <SubagentForm
        open={showSubagentForm}
        editSubagent={editSubagent}
        busyCrud={busyCrud}
        form={saForm.form}
        setField={saForm.setField}
        onClose={() => setShowSubagentForm(false)}
        onSave={() => void saveSubagent()}
      />

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {deleteConfirm && (
        <Modal title="Confirm Delete" onClose={() => setDeleteConfirm(null)}>
          <div className="font-mono text-[11px] text-[var(--dim)] mb-4">Are you sure you want to delete this {tab === 'agents' ? 'agent' : 'subagent'}?</div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => { if (tab === 'agents') void deleteAgent(deleteConfirm); else void deleteSubagent(deleteConfirm); }} disabled={busyCrud}>{busyCrud ? '\u2026' : 'Delete'}</Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
