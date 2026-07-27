// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// DASHBOARD WRAPPER — client component that fetches metrics from multiple
// API endpoints so the dashboard has rich health data at a glance.
// ============================================================================

'use client';

import * as React from 'react';
import { Card, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import { ContextPipeline } from '@/components/dashboard/context-pipeline';
import { MatrixViz } from '@/components/dashboard/matrix-viz';
import { colorForKind } from '@/components/live/event-timeline-bar';
import type { LearningCandidate, SubagentDef, SandboxPlugin, MeshPeer, BindingDefinition } from '@/lib/demo-store';

interface DashboardData {
  projectId: string;
  matrix: Record<string, Record<string, number>>;
  totalEntries: number;
  sessions: { active: number; total: number };
  auditValid: boolean;
  learning: LearningCandidate[];
  engineStatus?: 'real' | 'demo';
}

export function DashboardWrapper({
  initialData,
  initialMatrix,
}: {
  initialData: DashboardData | null;
  initialMatrix: Record<string, Record<string, number>>;
}) {
  // Live events for the activity feed
  const { events } = useLiveEvents(['session.started', 'subagent.spawned', 'subagent.returned', 'agent.message', 'session.ended'], 10);

  // Client-fetched metrics to enrich the dashboard
  const [subagents, setSubagents] = React.useState<SubagentDef[]>([]);
  const [sandbox, setSandbox] = React.useState<SandboxPlugin[]>([]);
  const [peers, setPeers] = React.useState<MeshPeer[]>([]);
  const [mcp, setMcp] = React.useState<{ status: string; transports: Array<{ kind: string; state: string }> } | null>(null);
  const [bindings, setBindings] = React.useState<BindingDefinition[]>([]);
  const [latency, setLatency] = React.useState<number | null>(null);

  React.useEffect(() => {
    void (async () => {
      const [subRes, sandRes, peerRes, mcpRes, bindRes, obsRes] = await Promise.all([
        api.get<{ subagents: SubagentDef[] }>('/api/agents/subagents'),
        api.get<{ plugins: SandboxPlugin[] }>('/api/agents/sandbox'),
        api.get<{ peers: MeshPeer[] }>('/api/mesh'),
        api.get<{ status: string; transports: Array<{ kind: string; state: string }> }>('/api/agents/mcp'),
        api.get<{ bindings: BindingDefinition[] }>('/api/agents/bindings'),
        api.get<{ latency: { queryMs: number; sloMs: number; pass: boolean } }>('/api/observability'),
      ]);
      if (subRes.ok && subRes.data) setSubagents(subRes.data.subagents);
      if (sandRes.ok && sandRes.data) setSandbox(sandRes.data.plugins);
      if (peerRes.ok && peerRes.data) setPeers(peerRes.data.peers);
      if (mcpRes.ok && mcpRes.data) setMcp(mcpRes.data);
      if (bindRes.ok && bindRes.data) setBindings(bindRes.data.bindings);
      if (obsRes.ok && obsRes.data) setLatency(obsRes.data.latency.queryMs);
    })();
  }, []);

  const activeSessions = initialData?.sessions.active ?? 0;
  const runningSubs = subagents.filter((s) => s.status === 'running').length;
  const errorSubs = subagents.filter((s) => s.status === 'error').length;
  const activePlugins = sandbox.filter((p) => p.state === 'active').length;
  const crashedPlugins = sandbox.filter((p) => p.state === 'crashed').length;
  const connectedPeers = peers.filter((p) => p.connected).length;
  const activeBindings = bindings.filter((b) => b.state === 'active').length;
  const enabledMcp = mcp ? (mcp.transports.filter((t) => t.kind !== undefined).length) : 0;
  const pendingCandidates = (initialData?.learning ?? []).filter((c) => c.status === 'pending').length;

  const isDemo = initialData?.engineStatus === 'demo';

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      {isDemo && (
        <div className="mb-4 rounded-sm border border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] px-4 py-2 font-mono text-data-xs text-[var(--rust)]">
          🔴 Engine offline &mdash; showing demo data
        </div>
      )}
      {/* ===== Stats Row ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Memory Entries" value={initialData?.totalEntries ?? 0} accent="teal" />
        <StatCard label="Active Sessions" value={activeSessions} accent="rust" detail={initialData?.sessions.total ? `${initialData.sessions.total} total` : undefined} />
        <StatCard label="Subagents" value={`${runningSubs}/${subagents.length}`} accent="plum" detail={errorSubs > 0 ? `${errorSubs} error` : undefined} />
        <StatCard label="Sandbox" value={`${activePlugins}/${sandbox.length}`} accent="olive" detail={crashedPlugins > 0 ? `${crashedPlugins} crashed` : undefined} />
        <StatCard label="MCP Servers" value={`${enabledMcp}/2`} accent="slate" />
        <StatCard label="Mesh Peers" value={`${connectedPeers}/${peers.length}`} accent="teal" />
        <StatCard label="Bindings" value={activeBindings} accent="amber" detail={`${bindings.length} platforms`} />
        <StatCard label="Candidates" value={pendingCandidates} accent="plum" detail={initialData?.learning.length ? `${initialData.learning.length} total` : undefined} />
      </div>

      {/* ===== Main Content ===== */}
      <div className="mt-5 flex flex-col lg:flex-row gap-5">
        {/* Left column: Pipeline + Matrix */}
        <div className="min-w-0 flex-1 space-y-5">
          <ContextPipeline />
          <MatrixViz matrix={initialMatrix} />
        </div>

        {/* Right column: Health Panel */}
        <div className="w-full lg:w-[340px] shrink-0 space-y-4">
          {/* Agent Activity Feed */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-data-sm font-extrabold uppercase tracking-[0.1em] text-[var(--dim)]">Agent Activity</span>
              <Badge tone="olive">live</Badge>
            </div>
            <div className="flex flex-col-reverse gap-1 max-h-[200px] overflow-y-auto scroll-thin">
              {events.length === 0 && (
                <div className="py-4 text-center font-mono text-data-xs text-[var(--faint)]">waiting for agents\u2026</div>
              )}
              {events.map((e: { id: string; kind: string; ts: string; actor?: string }) => (
                <div key={e.id} className="flex animate-slide-in-top items-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorForKind(e.kind) }} />
                  <span className="font-mono text-[9px] font-bold truncate max-w-[80px]" style={{ color: colorForKind(e.kind) }}>{e.kind.split('.')[1] ?? e.kind}</span>
                  <span className="ml-auto font-mono text-[8.5px] text-[var(--faint)]">{new Date(e.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Sandbox Plugin Mini */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-data-sm font-extrabold uppercase tracking-[0.1em] text-[var(--dim)]">Sandbox</span>
              <div className="flex items-center gap-2 font-mono text-[9px]">
                <span className="text-[var(--olive)]">{activePlugins} active</span>
                {crashedPlugins > 0 && <span className="text-[var(--rust)]">{crashedPlugins} crashed</span>}
              </div>
            </div>
            <div className="space-y-1">
              {sandbox.slice(0, 5).map((p) => (
                <div key={p.name} className="flex items-center gap-2 rounded-sm bg-[var(--paper)] px-2 py-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    p.state === 'active' ? 'bg-[var(--olive)]' : p.state === 'crashed' ? 'bg-[var(--rust)]' : 'bg-[var(--faint)]'
                  }`} />
                  <span className="font-mono text-[10px] font-bold text-[var(--ink)]">{p.name}</span>
                  <span className="ml-auto font-mono text-[8.5px] text-[var(--faint)]">{p.kind}</span>
                  {p.crashCount > 0 && (
                    <span className="font-mono text-[8.5px] text-[var(--rust)]">{'\u26A0'}{p.crashCount}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Mesh + Bindings Mini */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-data-sm font-extrabold uppercase tracking-[0.1em] text-[var(--dim)]">Network</span>
              <span className="font-mono text-[9px] text-[var(--teal)]">{connectedPeers}/{peers.length} peers</span>
            </div>
            <div className="space-y-1.5">
              {peers.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-sm bg-[var(--paper)] px-2 py-1 font-mono text-[10px]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.connected ? 'bg-[var(--olive)] animate-pulse' : 'bg-[var(--faint)]'}`} />
                  <span className="font-bold text-[var(--ink)]">{p.name}</span>
                  <span className="text-[var(--faint)]">{p.latency}ms</span>
                  <span className="ml-auto text-[var(--dim)]">{p.transport}</span>
                </div>
              ))}
              <div className="border-t border-[var(--line)] pt-1.5 mt-1.5">
                <div className="font-mono text-[9px] text-[var(--faint)] mb-1">IDE Bindings</div>
                <div className="flex flex-wrap gap-1">
                  {bindings.map((b) => (
                    <span
                      key={b.platform}
                      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[8.5px] font-bold ${
                        b.state === 'active' ? 'bg-[color-mix(in_oklab,var(--olive)_14%,transparent)] text-[var(--olive)]' : 'text-[var(--faint)]'
                      }`}
                    >
                      {b.platform}
                      {b.state === 'active' && <span className="text-[7px]">{'\u2713'}</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Latency Mini */}
          {latency !== null && (
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-data-sm font-extrabold uppercase tracking-[0.1em] text-[var(--dim)]">Query Latency</span>
                <span className="font-mono text-[18px] font-extrabold text-[var(--teal)]">{latency}<span className="text-[10px]">ms</span></span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--paper2)]">
                <div className="h-full rounded-full bg-[var(--teal)] transition-all duration-500" style={{ width: `${Math.min(100, (latency / 100) * 100)}%` }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[8.5px] text-[var(--faint)]">
                <span>0ms</span>
                <span>SLO 100ms</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, detail }: {
  label: string; value: string | number; accent: string; detail?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: 'var(--teal)', rust: 'var(--rust)', plum: 'var(--plum)',
    olive: 'var(--olive)', slate: 'var(--slate)', amber: 'var(--amber)',
  };
  return (
    <Card className="px-3.5 py-3">
      <div className="font-mono text-data-xs uppercase tracking-[0.08em] text-[var(--faint)]">{label}</div>
      <div className="mt-0.5 font-mono text-[22px] font-extrabold" style={{ color: colorMap[accent] ?? 'var(--ink)' }}>{value}</div>
      {detail && <div className="mt-0.5 font-mono text-[9px] text-[var(--dim)]">{detail}</div>}
    </Card>
  );
}
