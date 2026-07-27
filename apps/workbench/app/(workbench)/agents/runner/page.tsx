// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT RUNNER — live observation of agent network flow.
// Shows the AgentNetwork visualization with directional pulse animations
// driven by live events, plus RunLogs for real-time event streaming.
//
// Sandbox and skill management are handled by /plugins and /skills pages.
// Session list/management is handled by /sessions page.
// ============================================================================

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Panel } from '@/components/ui';
import { AgentNetwork } from '@/components/agents/agent-network';
import { RunLogs } from '@/components/agents/run-logs';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';
import type { Session } from '@/lib/demo-store';

export default function RunnerPage() {
  const { connected, events } = useLiveEvents();
  const [sessions, setSessions] = React.useState<Session[]>([]);

  React.useEffect(() => {
    void (async () => {
      const sessRes = await api.get<{ sessions: Session[] }>('/api/sessions');
      if (sessRes.ok && sessRes.data) setSessions(sessRes.data.sessions);
    })();
  }, []);

  const lead = sessions[0];
  const subs = lead?.subagents ?? [];
  const runningCount = sessions.filter((s) => s.state === 'running').length;
  const errorCount = sessions.filter((s) => s.state === 'error').length;

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <SectionTitle sub="Observe live agent network flow and event stream">Agent Runner</SectionTitle>

      {/* Agent status bar */}
      <div className="mt-2 flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-[var(--olive)]" />
          <span className="font-bold text-[var(--olive)]">{runningCount} running</span>
        </span>
        <span className="font-mono text-[10px] text-[var(--dim)]">{sessions.length} sessions</span>
        {errorCount > 0 && (
          <Badge tone="rust">{errorCount} error</Badge>
        )}
        <Badge tone={connected ? 'olive' : 'neutral'}>{connected ? 'live' : 'connecting'}</Badge>
      </div>

      <div className="mt-4 flex gap-5">
        {/* Main content — Agent Network visualization */}
        <div className="min-w-0 flex-1">
          <Card className="min-h-[500px] p-0 overflow-hidden">
            <div className="border-b border-[var(--line)] px-4 py-2 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
              Agent Network · directional flow
            </div>
            <div className="p-3">
              <AgentNetwork subs={subs} events={events} />
            </div>
          </Card>
        </div>

        {/* Sidebar — Lead agent info + Run logs */}
        <div className="hidden lg:block shrink-0 w-[320px] space-y-4">
          <Panel title="Lead Agent" action={<Badge tone="teal">{lead?.state ?? '—'}</Badge>}>
            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-[var(--faint)]">agent</span><span className="font-bold text-[var(--ink)]">{lead?.agent_name ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--faint)]">session</span><span className="text-[var(--dim)]">{lead?.session_id ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--faint)]">progress</span><span className="font-bold text-[var(--teal)]">{lead?.progress != null ? `${Math.round(lead.progress * 100)}%` : '—'}</span></div>
              {lead?.progress != null && (
                <div className="h-1.5 rounded-full bg-[var(--paper2)]">
                  <div className="h-full rounded-full bg-[var(--teal)] transition-all duration-500" style={{ width: `${Math.round(lead.progress * 100)}%` }} />
                </div>
              )}
            </div>
            {subs.length > 0 && (
              <div className="mt-3 border-t border-[var(--line)] pt-2">
                <div className="mb-1 font-mono text-[9.5px] font-extrabold uppercase text-[var(--faint)]">subagents</div>
                <div className="space-y-1">
                  {subs.map((s) => (
                    <div key={s.session_id} className="flex items-center justify-between rounded-[6px] bg-[var(--paper)] px-2 py-1 font-mono text-[10px]">
                      <span className="text-[var(--ink)]">{s.agent_name}</span>
                      <span className="font-bold text-[var(--plum)]">{s.state}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <RunLogs />
        </div>
      </div>
    </div>
  );
}
