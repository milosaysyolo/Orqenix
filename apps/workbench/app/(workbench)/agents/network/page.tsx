'use client';

import * as React from 'react';
import { SectionTitle, Card } from '@/components/ui';
import { AgentNetwork } from '@/components/agents/agent-network';
import { RunLogs } from '@/components/agents/run-logs';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface Session { session_id: string; agent_name: string; state: string; subagents?: Session[]; }

export default function NetworkPage() {
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const { events } = useLiveEvents();

  const load = React.useCallback(async () => {
    const res = await api.get<{ sessions: Session[] }>('/api/agents/network');
    if (res.ok) setSessions(res.data!.sessions);
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { if (events.length) void load(); }, [events.length, load]);

  const subs = sessions.flatMap((s) => s.subagents ?? []);

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <SectionTitle sub="Realtime view of all agents, subagents, and services">Network</SectionTitle>
      <div className="mt-4 grid grid-cols-[1fr_340px] gap-4">
        <Card className="min-h-[560px] p-3">
          <AgentNetwork subs={subs} events={events} />
        </Card>
        <RunLogs />
      </div>
    </div>
  );
}
