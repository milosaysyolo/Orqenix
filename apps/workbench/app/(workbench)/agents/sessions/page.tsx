'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface Session {
  session_id: string; agent_name: string; agent_platform: string; model: string;
  branch_id: string; state: string; team_session_with: string | null; task: string;
  steps_done: number; steps_total: number; tokens: number; started_at: string;
  subagents?: Session[];
}

type BadgeTone = 'rust' | 'amber' | 'teal' | 'plum' | 'olive' | 'slate' | 'neutral';
const STATE_TONE: Record<string, BadgeTone> = {
  active: 'olive', paused: 'amber', error: 'rust', completed: 'neutral',
};
function getStateTone(state: string): BadgeTone { return STATE_TONE[state] ?? 'neutral'; }

export default function SessionsPage() {
  const [filter, setFilter] = React.useState<'active' | 'paused' | 'completed' | 'all'>('active');
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [counts, setCounts] = React.useState({ active: 0, paused: 0, total: 0 });
  const [selected, setSelected] = React.useState<Session | null>(null);
  const { events } = useLiveEvents(['session.updated', 'session.started', 'subagent.spawned']);

  const load = React.useCallback(async () => {
    const res = await api.get<{ sessions: Session[]; counts: typeof counts }>(`/api/sessions?state=${filter}`);
    if (res.ok) { setSessions(res.data!.sessions); setCounts(res.data!.counts); }
  }, [filter]);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { if (events.length) void load(); }, [events.length, load]);

  async function control(action: 'pause' | 'resume' | 'abort' | 'clone', sessionId: string) {
    await api.post('/api/sessions', { action, sessionId });
    await load();
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <SectionTitle sub="Live, paused, and past agent sessions">Sessions</SectionTitle>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="Active" value={counts.active} accent="olive" />
        <Stat label="Paused" value={counts.paused} accent="amber" />
        <Stat label="Total" value={counts.total} />
        <Stat label="Team Sessions" value={sessions.filter((s) => s.team_session_with).length} accent="plum" />
      </div>

      <div className="mt-4 flex gap-2">
        {(['active', 'paused', 'completed', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={'rounded-[9px] px-3 py-1 font-mono text-[11px] font-semibold capitalize ' +
              (filter === f ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>{f}</button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">No sessions.</Card>
          ) : sessions.map((s) => (
            <div key={s.session_id}>
              <button onClick={() => setSelected(s)}
                className="flex w-full items-center gap-3 rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-left transition-colors hover:border-[var(--rust)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: `var(--${getStateTone(s.state)})` }} />
                <span className="font-mono text-[11px] font-bold text-[var(--ink)]">{s.session_id.slice(0, 18)}&hellip;</span>
                {s.team_session_with ? <Badge tone="plum">team</Badge> : <Badge tone="neutral">isolated</Badge>}
                <Badge tone="teal">{s.agent_platform}</Badge>
                <span className="font-mono text-[10px] text-[var(--dim)]">{s.steps_done}/{s.steps_total}</span>
                {s.subagents && s.subagents.length > 0 && <span className="font-mono text-[10px] text-[var(--faint)]">&lsaquo; {s.subagents.length}</span>}
                <Badge tone={getStateTone(s.state)} className="ml-auto">{s.state}</Badge>
              </button>
              {s.subagents?.map((sub) => (
                <div key={sub.session_id} className="ml-6 mt-1 flex items-center gap-2 rounded-[9px] border border-dashed border-[var(--line)] bg-[var(--paper)] px-3 py-1.5">
                  <span className="text-[var(--faint)]">&lsaquo;</span>
                  <Badge tone="plum">subagent</Badge>
                  <span className="font-mono text-[10.5px] text-[var(--ink)]">{sub.agent_name}</span>
                  <span className="font-mono text-[9.5px] text-[var(--dim)]">{sub.steps_done}/{sub.steps_total}</span>
                  <Badge tone={getStateTone(sub.state)} className="ml-auto">{sub.state}</Badge>
                </div>
              ))}
            </div>
          ))}
        </div>

        <Card className="h-fit p-4">
          {!selected ? (
            <div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Select a session.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone={getStateTone(selected.state)}>{selected.state}</Badge>
                {selected.team_session_with && <Badge tone="plum">team</Badge>}
              </div>
              <div className="font-mono text-[12px] font-bold text-[var(--ink)]">{selected.session_id}</div>
              <div className="grid grid-cols-[80px_1fr] gap-y-1 font-mono text-[10.5px]">
                <span className="text-[var(--faint)]">Agent</span><span className="text-[var(--ink)]">{selected.agent_name}</span>
                <span className="text-[var(--faint)]">Model</span><span className="text-[var(--ink)]">{selected.model}</span>
                <span className="text-[var(--faint)]">Branch</span><span className="text-[var(--ink)]">{selected.branch_id?.slice(0, 16)}</span>
                <span className="text-[var(--faint)]">Task</span><span className="text-[var(--ink)]">{selected.task}</span>
                <span className="text-[var(--faint)]">Progress</span><span className="text-[var(--olive)]">{selected.steps_done}/{selected.steps_total}</span>
              </div>
              {selected.subagents && selected.subagents.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[10px] font-bold uppercase text-[var(--faint)]">Subagents ({selected.subagents.length})</div>
                  {selected.subagents.map((sub) => (
                    <div key={sub.session_id} className="flex items-center gap-2 py-0.5 font-mono text-[10.5px]">
                      <Badge tone={getStateTone(sub.state)}>{sub.state}</Badge>
                      <span className="text-[var(--ink)]">{sub.agent_name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.state === 'active'
                  ? <Button variant="outline" size="sm" onClick={() => control('pause', selected.session_id)}>Pause</Button>
                  : selected.state === 'paused'
                    ? <Button variant="outline" size="sm" onClick={() => control('resume', selected.session_id)}>Resume</Button>
                    : null}
                <Button variant="danger" size="sm" onClick={() => control('abort', selected.session_id)}>Abort</Button>
                <Button variant="ghost" size="sm" onClick={() => control('clone', selected.session_id)}>Clone</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
