'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { AgentNetwork } from '@/components/agents/agent-network';
import { RunLogs } from '@/components/agents/run-logs';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface Session { session_id: string; agent_name: string; agent_platform: string; state: string; steps_done: number; steps_total: number; task: string; subagents?: Session[]; }

export default function RunnerPage() {
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const { events } = useLiveEvents();

  const load = React.useCallback(async () => {
    const res = await api.get<{ sessions: Session[] }>('/api/sessions?state=active');
    if (res.ok) { setSessions(res.data!.sessions); if (!selected && res.data!.sessions[0]) setSelected(res.data!.sessions[0].session_id); }
  }, [selected]);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { if (events.length) void load(); }, [events.length, load]);

  const sel = sessions.find((s) => s.session_id === selected) ?? null;

  async function control(action: 'pause' | 'abort') {
    if (!selected) return;
    await api.post('/api/sessions', { action, sessionId: selected });
    await load();
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <SectionTitle sub="Live agent execution & communication">Agent Runner</SectionTitle>

      <div className="mt-4 grid grid-cols-[260px_1fr_340px] gap-4">
        <Card className="p-3">
          <div className="mb-2 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">Active Runs ({sessions.length})</div>
          <div className="space-y-1.5">
            {sessions.length === 0 ? (
              <div className="py-6 text-center font-mono text-[10.5px] text-[var(--faint)]">No active runs. Launch a team in the Orchestrator.</div>
            ) : sessions.map((s) => (
              <button key={s.session_id} onClick={() => setSelected(s.session_id)}
                className={'block w-full rounded-[9px] border bg-[var(--paper)] p-2 text-left transition-colors ' +
                  (selected === s.session_id ? 'border-[var(--rust)]' : 'border-[var(--line)] hover:border-[var(--rust)]')}>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--olive)]" />
                  <span className="font-mono text-[11px] font-bold text-[var(--ink)]">{s.agent_name}</span>
                  <span className="ml-auto font-mono text-[9.5px] text-[var(--dim)]">{s.steps_done}/{s.steps_total}</span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[9.5px] text-[var(--dim)]">{s.task}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-h-[520px] p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Agent Network</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--olive)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--olive)]" />live</span>
          </div>
          <AgentNetwork sessions={sessions} events={events} />
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            {!sel ? <div className="py-6 text-center font-mono text-[11px] text-[var(--faint)]">Select a run.</div> : (
              <div className="space-y-2">
                <div className="font-mono text-[12px] font-bold text-[var(--ink)]">{sel.agent_name}</div>
                <div className="grid grid-cols-[70px_1fr] gap-y-0.5 font-mono text-[10px]">
                  <span className="text-[var(--faint)]">Platform</span><span className="text-[var(--ink)]">{sel.agent_platform}</span>
                  <span className="text-[var(--faint)]">Progress</span><span className="text-[var(--olive)]">{sel.steps_done}/{sel.steps_total}</span>
                  <span className="text-[var(--faint)]">Task</span><span className="text-[var(--ink)]">{sel.task}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => control('pause')}>Pause</Button>
                  <Button variant="danger" size="sm" onClick={() => control('abort')}>Abort</Button>
                </div>
              </div>
            )}
          </Card>
          <RunLogs />
        </div>
      </div>
    </div>
  );
}
