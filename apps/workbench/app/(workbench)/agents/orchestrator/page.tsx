// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { CollapseToggle } from '@/components/collapse-toggle';
import { useToast } from '@/components/toast';
import { TeamCanvas } from '@/components/canvas/team-canvas';
import { AgentLibrary } from '@/components/agents/agent-library';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import type { TeamNode, TeamEdge, SyncResult, SyncMode } from '@/lib/demo-store';

type OrchTab = 'canvas' | 'sync' | 'plugins' | 'manifest';

const PLUGIN_KINDS = [
  { kind: 'knowledge-source', label: 'Knowledge Source' },
  { kind: 'embedding-model', label: 'Embedding Model' },
  { kind: 'reranker', label: 'Reranker' },
  { kind: 'compression-strategy', label: 'Compression' },
  { kind: 'memory-injection-strategy', label: 'Injection Strategy' },
  { kind: 'prompt-rewriter', label: 'Prompt Rewriter' },
  { kind: 'visualization', label: 'Visualization' },
  { kind: 'code-analyzer', label: 'Code Analyzer' },
  { kind: 'kb-schema', label: 'KB Schema' },
  { kind: 'mcp-server', label: 'MCP Server' },
  { kind: 'agent', label: 'Agent' },
  { kind: 'subagent', label: 'Subagent' },
  { kind: 'skill', label: 'Skill' },
  { kind: 'agent-binding', label: 'Agent Binding' },
];

export default function OrchestratorPage() {
  const { toast } = useToast();
  const { connected } = useLiveEvents();
  const [team, setTeam] = React.useState<{ nodes: TeamNode[]; edges: TeamEdge[] }>({ nodes: [], edges: [] });
  const [teamLoading, setTeamLoading] = React.useState(true);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [tab, setTab] = React.useState<OrchTab>('canvas');

  // Manifest dynamic data
  const [skillNames, setSkillNames] = React.useState<string[]>([]);
  const [manifestLoading, setManifestLoading] = React.useState(false);

  // Plugin lifecycle demo state
  const [pluginLifecycle, setPluginLifecycle] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    PLUGIN_KINDS.forEach((p) => { init[p.kind] = 'install'; });
    return init;
  });
  const [busyPlugin, setBusyPlugin] = React.useState<string | null>(null);

  // SyncEngine state
  const [syncMode, setSyncMode] = React.useState<SyncMode>('sync');
  const [syncResults, setSyncResults] = React.useState<SyncResult[]>([]);
  const [lastSync, setLastSync] = React.useState<SyncResult | null>(null);
  const [busySync, setBusySync] = React.useState(false);

  const loadSync = React.useCallback(async () => {
    const res = await api.get<{ results: SyncResult[] }>('/api/agents/teams/sync');
    if (res.ok && res.data) { setSyncResults(res.data.results); setLastSync(res.data.results[0] ?? null); }
  }, []);

  React.useEffect(() => { if (tab === 'sync') void loadSync(); }, [tab, loadSync]);

  async function runSyncNow() {
    setBusySync(true);
    const res = await api.post<SyncResult>('/api/agents/teams/sync', { mode: syncMode });
    setBusySync(false);
    if (res.ok && res.data) {
      setLastSync(res.data);
      setSyncResults((prev) => [res.data as SyncResult, ...prev].slice(0, 12));
      const tone = res.data.status === 'success' ? 'success' : res.data.status === 'conflicts' ? 'error' : 'info';
      toast({ tone, title: `Sync (${res.data.mode})`, message: `${res.data.written.length} written, ${res.data.drift.length} drift, ${res.data.conflicts.length} conflicts` });
    } else {
      toast({ tone: 'error', title: 'Sync failed', message: res.error ?? 'unknown' });
    }
  }

  const latestRef = React.useRef(team);
  React.useEffect(() => { latestRef.current = team; }, [team]);

  const load = React.useCallback(async () => {
    setTeamLoading(true);
    const res = await api.get<{ nodes: TeamNode[]; edges: TeamEdge[] }>('/api/agents/teams');
    if (res.ok && res.data) setTeam(res.data);
    setTeamLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // Load manifest data when switching to manifest tab
  React.useEffect(() => {
    if (tab === 'manifest') {
      setManifestLoading(true);
      Promise.all([
        api.get<{ skills: Array<{ name: string }> }>('/api/skills'),
        api.get<{ status: string; endpoint: string }>('/api/agents/mcp'),
      ]).then(([skillsRes]) => {
        if (skillsRes.ok && skillsRes.data) {
          setSkillNames(skillsRes.data.skills.map((s) => s.name));
        }
        setManifestLoading(false);
      });
    }
  }, [tab]);

  async function save() {
    const payload = latestRef.current;
    const res = await api.post<{ ok: boolean }>('/api/agents/teams', payload);
    if (res.ok) toast({ tone: 'success', title: 'Team saved', message: `${payload.nodes.length} nodes, ${payload.edges.length} edges` });
    else toast({ tone: 'error', title: 'Save failed', message: res.error ?? 'unknown' });
  }

  const onTeamChange = React.useCallback((nodes: TeamNode[], edges: TeamEdge[]) => {
    setTeam({ nodes, edges });
  }, []);

  async function advanceLifecycle(kind: string) {
    setBusyPlugin(kind);
    const res = await api.post<{ ok: boolean; stage: string }>(`/api/agents/teams/plugins/${kind}/advance`);
    setBusyPlugin(null);
    if (res.ok && res.data) {
      const next = res.data.stage;
      setPluginLifecycle((prev) => ({ ...prev, [kind]: next }));
      if (next === 'activate') {
        toast({ tone: 'success', title: kind, message: 'activated', duration: 1500 });
      }
    } else {
      toast({ tone: 'error', title: kind, message: res.error ?? 'cannot advance' });
    }
  }

  const TABS: { key: OrchTab; label: string }[] = [
    { key: 'canvas', label: 'Team Canvas' },
    { key: 'sync', label: 'Sync' },
    { key: 'plugins', label: 'Plugin Lifecycle' },
    { key: 'manifest', label: 'Team Manifest' },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionTitle sub="Compose teams of agents on the canvas">Agent Orchestrator</SectionTitle>
        <div className="flex items-center gap-2">
          <Badge tone={connected ? 'olive' : 'neutral'}>{connected ? 'live' : 'offline'}</Badge>
          {tab === 'canvas' && (
            <Button size="sm" variant="primary" onClick={() => void save()}>save</Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="inline-flex rounded-[9px] border border-[var(--line2)] p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={'rounded-[7px] px-3 py-1 font-mono text-[11px] font-semibold capitalize transition-colors ' +
                (tab === t.key ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile (<640px): stacked */}
      <div className="mt-4 sm:hidden">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--dim)]">Agent Library</span>
        </div>
        <div className="mt-1 mb-3">
          <AgentLibrary existingNodeIds={team.nodes.map((n) => n.id)} />
        </div>
        {tab === 'canvas' && (
          <Card className="h-[350px] overflow-hidden p-0">
            {team.nodes.length === 0 ? (
              <div className="grid h-full place-items-center font-mono text-[11px] text-[var(--faint)]">loading canvas…</div>
            ) : (
              <TeamCanvas initialNodes={team.nodes} initialEdges={team.edges} onChange={onTeamChange} />
            )}
          </Card>
        )}
      </div>

      {/* Tablet & Desktop (640px+): sidebar + content */}
      <div className="mt-4 hidden sm:flex gap-4">
        {/* Left sidebar – collapsible */}
        <div className="relative shrink-0 transition-all duration-200" style={{ width: sidebarOpen ? 180 : 44 }}>
          {/* Panel content */}
          <div className="overflow-hidden transition-all duration-200" style={{ width: sidebarOpen ? 180 : 0, opacity: sidebarOpen ? 1 : 0 }}>
            <AgentLibrary existingNodeIds={team.nodes.map((n) => n.id)} />
          </div>

          {/* Floating collapse button (panel open) */}
          <div
            className="absolute top-3 z-10 transition-all duration-200"
            style={{ right: -12, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transform: sidebarOpen ? 'scale(1)' : 'scale(0.85)' }}
          >
            <CollapseToggle collapsed={false} onToggle={() => setSidebarOpen(false)} side="left" label="Collapse library" />
          </div>
          {/* Expand button (panel collapsed) */}
          <div
            className="absolute left-1 top-3 z-10 flex items-center gap-2 transition-all duration-200"
            style={{ opacity: sidebarOpen ? 0 : 1, pointerEvents: sidebarOpen ? 'none' : 'auto', transform: sidebarOpen ? 'translateX(-8px) scale(0.85)' : 'translateX(0) scale(1)' }}
          >
            <span className="h-px w-3 bg-[var(--line)]" />
            <CollapseToggle collapsed={true} onToggle={() => setSidebarOpen(true)} side="left" label="Show library" />
            <span className="h-px w-3 bg-[var(--line)]" />
          </div>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {tab === 'canvas' && (
            <Card className="h-[400px] overflow-hidden p-0 lg:h-[520px]">
              {teamLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="space-y-3 w-full max-w-sm p-6">
                    <div className="h-4 w-40 rounded bg-[var(--line)] animate-pulse mx-auto" />
                    <div className="h-3 w-60 rounded bg-[var(--line)] animate-pulse mx-auto" />
                  </div>
                </div>
              ) : team.nodes.length === 0 ? (
                <div className="grid h-full place-items-center">
                  <div className="text-center font-mono text-[11px] text-[var(--faint)]">
                    <div className="text-[32px] text-[var(--plum)] opacity-30 mb-2">{'\u25C7'}</div>
                    <div className="text-[13px] font-bold text-[var(--dim)] mb-1">Canvas is empty</div>
                    <div className="mb-3">Drag agents from the sidebar onto the canvas</div>
                    <div className="flex items-center justify-center gap-2">
                      <Badge tone="plum">{'\u25C7'} Agent</Badge>
                      <Badge tone="olive">{'\u25A3'} Service</Badge>
                      <Badge tone="rust">{'\u25C9'} Subagent</Badge>
                    </div>
                    <div className="mt-3 text-[9.5px] text-[var(--faint)]">
                      Connect nodes by dragging between them &middot; Del to remove
                    </div>
                  </div>
                </div>
              ) : (
                <TeamCanvas initialNodes={team.nodes} initialEdges={team.edges} onChange={onTeamChange} />
              )}
            </Card>
          )}

          {tab === 'plugins' && (
            <Card className="p-4">
              <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
                14 Plugin Kinds · Lifecycle Orchestrator
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {PLUGIN_KINDS.map((p) => {
                  const stage = pluginLifecycle[p.kind] ?? 'install';
                  const isFinal = stage === 'uninstall';
                  const stageColors: Record<string, string> = {
                    install: 'var(--faint)', configure: 'var(--amber)',
                    activate: 'var(--teal)', deactivate: 'var(--plum)', uninstall: 'var(--slate)',
                  };
                  return (
                    <div
                      key={p.kind}
                      className="flex items-center gap-2 rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stageColors[stage] ?? 'var(--faint)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[10px] font-bold text-[var(--ink)]">{p.label}</div>
                        <div className="font-mono text-[8.5px] text-[var(--faint)]">kind: {p.kind}</div>
                      </div>
                      <span className="font-mono text-[9px] text-[var(--dim)]">{stage}</span>
                      {!isFinal && (
                        <Button size="sm" variant="ghost" onClick={() => advanceLifecycle(p.kind)} disabled={busyPlugin === p.kind}>
                          {busyPlugin === p.kind ? '…' : '\u2192'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-[7px] bg-[color-mix(in_oklab,var(--amber)_8%,transparent)] px-3 py-2 font-mono text-[9.5px] text-[var(--amber)]">
                Lifecycle: install → configure → activate → deactivate → uninstall (ADR-E-006: 14 kinds locked)
              </div>
            </Card>
          )}

          {tab === 'sync' && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
                  SyncEngine
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-[7px] border border-[var(--line2)] p-0.5">
                    {(['sync', 'dry-run', 'verify'] as SyncMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSyncMode(m)}
                        className={'rounded-[5px] px-2.5 py-1 font-mono text-[10px] font-semibold capitalize transition-colors ' +
                          (syncMode === m ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" variant="primary" onClick={() => void runSyncNow()} disabled={busySync}>
                    {busySync ? '…' : 'Run Sync'}
                  </Button>
                </div>
              </div>

              {/* Mode hint */}
              <div className="mb-3 rounded-[7px] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] px-3 py-2 font-mono text-[9.5px] text-[var(--rust)]">
                {syncMode === 'sync' && 'sync: compile team agents to OpenCode output and write changed files'}
                {syncMode === 'dry-run' && 'dry-run: preview what would be written without touching output files'}
                {syncMode === 'verify' && 'verify: detect drift between source and output — no writes'}
              </div>

              {/* Last result */}
              {lastSync && (
                <div className="mb-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={lastSync.status === 'success' ? 'olive' : lastSync.status === 'conflicts' ? 'rust' : 'amber'}>
                      {lastSync.status}
                    </Badge>
                    <span className="font-mono text-[9.5px] text-[var(--faint)]">
                      {new Date(lastSync.timestamp).toLocaleTimeString()} · {lastSync.mode}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                      <div className="text-[var(--faint)]">Written</div>
                      <div className="font-bold text-[var(--olive)]">{lastSync.written.length}</div>
                    </div>
                    <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                      <div className="text-[var(--faint)]">Drift</div>
                      <div className="font-bold text-[var(--amber)]">{lastSync.drift.length}</div>
                    </div>
                    <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                      <div className="text-[var(--faint)]">Conflicts</div>
                      <div className="font-bold text-[var(--rust)]">{lastSync.conflicts.length}</div>
                    </div>
                  </div>

                  {lastSync.written.length > 0 && (
                    <div>
                      <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">WRITTEN</div>
                      <div className="space-y-0.5">
                        {lastSync.written.map((f) => (
                          <div key={f} className="rounded-[5px] bg-[color-mix(in_oklab,var(--olive)_8%,transparent)] px-2 py-1 font-mono text-[9.5px] text-[var(--olive)]">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastSync.drift.length > 0 && (
                    <div>
                      <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">DRIFT</div>
                      <div className="space-y-0.5">
                        {lastSync.drift.map((d) => (
                          <div key={d.agent} className="rounded-[5px] bg-[color-mix(in_oklab,var(--amber)_8%,transparent)] px-2 py-1 font-mono text-[9.5px] text-[var(--amber)]">
                            {d.agent} — {d.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastSync.conflicts.length > 0 && (
                    <div>
                      <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">CONFLICTS</div>
                      <div className="space-y-0.5">
                        {lastSync.conflicts.map((c) => (
                          <div key={c.agent} className="rounded-[5px] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] px-2 py-1 font-mono text-[9.5px] text-[var(--rust)]">
                            {c.agent} — src {c.sourceHash} ≠ out {c.outputHash} ({c.resolution})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History */}
              {syncResults.length > 0 && (
                <details open>
                  <summary className="cursor-pointer font-mono text-[10px] text-[var(--faint)] hover:text-[var(--ink)]">
                    History ({syncResults.length})
                  </summary>
                  <div className="mt-2 space-y-0.5">
                    {syncResults.slice(1).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono text-[9.5px]">
                        <Badge tone={r.status === 'success' ? 'olive' : r.status === 'conflicts' ? 'rust' : 'amber'}>{r.status}</Badge>
                        <span className="text-[var(--dim)]">{r.mode}</span>
                        <span className="text-[var(--faint)]">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          )}

          {tab === 'manifest' && (
            <Card className="p-4">
              <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
                Team Manifest
              </div>
              {manifestLoading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 rounded-[7px] bg-[var(--line)]" />
                  <div className="h-10 rounded-[7px] bg-[var(--line)]" />
                  <div className="h-10 rounded-[7px] bg-[var(--line)]" />
                </div>
              ) : (
              <div className="space-y-3 font-mono text-[10.5px]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Team Name</div>
                    <div className="font-bold text-[var(--ink)]">orqenix-main</div>
                  </div>
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Version</div>
                    <div className="font-bold text-[var(--ink)]">0.9.0</div>
                  </div>
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Core Agents</div>
                    <div className="font-bold text-[var(--teal)]">{team.nodes.filter((n) => n.type === 'agent').length}</div>
                  </div>
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Subagents</div>
                    <div className="font-bold text-[var(--plum)]">{team.nodes.filter((n) => n.type === 'subagent').length}</div>
                  </div>
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Services</div>
                    <div className="font-bold text-[var(--olive)]">{team.nodes.filter((n) => n.type === 'service').length}</div>
                  </div>
                  <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                    <div className="text-[var(--faint)]">Edges</div>
                    <div className="font-bold text-[var(--ink)]">{team.edges.length}</div>
                  </div>
                </div>

                <details>
                  <summary className="cursor-pointer font-mono text-[10px] text-[var(--faint)] hover:text-[var(--ink)]">Sync Targets</summary>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 rounded-[6px] bg-[var(--paper)] px-3 py-1.5">
                      <Badge tone="teal">opencode</Badge>
                      <span className="text-[var(--dim)]">output: .opencode/agents/</span>
                      <Badge tone="olive">enabled</Badge>
                    </div>
                    <div className="flex items-center gap-2 rounded-[6px] bg-[var(--paper)] px-3 py-1.5">
                      <Badge tone="plum">claude</Badge>
                      <span className="text-[var(--dim)]">output: .claude/agents/</span>
                      <Badge tone="neutral">disabled</Badge>
                    </div>
                  </div>
                  {lastSync && (
                    <div className="mt-2 font-mono text-[9.5px] text-[var(--faint)]">
                      Last sync: <span className={lastSync.status === 'success' ? 'text-[var(--olive)]' : lastSync.status === 'conflicts' ? 'text-[var(--rust)]' : 'text-[var(--amber)]'}>{lastSync.status}</span>
                      {' '}· {lastSync.mode} · {new Date(lastSync.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </details>

                <details>
                  <summary className="cursor-pointer font-mono text-[10px] text-[var(--faint)] hover:text-[var(--ink)]">
                    Skills ({skillNames.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {skillNames.length > 0 ? skillNames.map((n) => (
                      <Badge key={n} tone="plum">{n}</Badge>
                    )) : (
                      <span className="font-mono text-[9.5px] text-[var(--faint)]">No skills loaded.</span>
                    )}
                  </div>
                </details>
              </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Footer status bar (canvas tab only) */}
      {tab === 'canvas' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--faint)]">
          <span>{team.nodes.length} nodes</span>
          <span>{team.edges.length} edges</span>
          <span>drag agents from the library onto the canvas</span>
          <span>connect nodes to create edges</span>
          <span>Ctrl+Z to undo</span>
          <span>Del to remove</span>
        </div>
      )}
    </div>
  );
}
