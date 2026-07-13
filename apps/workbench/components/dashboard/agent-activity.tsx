// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT ACTIVITY — compact live feed of agent + session events on the dashboard
// sidebar. New rows slide in from the top.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel } from '@/components/ui';
import { useLiveEvents, type LiveEvent } from '@/lib/use-live-events';
import { colorForKind } from '@/components/live/event-timeline-bar';

const WATCH = ['session.started', 'subagent.spawned', 'subagent.returned', 'agent.message', 'session.ended'];

export function AgentActivity() {
  const { events } = useLiveEvents(WATCH, 14);

  return (
    <Panel title="Agent Activity" action={<span className="font-mono text-data-xs text-[var(--olive)]">live</span>}>
      <div className="flex flex-col-reverse gap-1.5">
        {events.length === 0 && <div className="py-4 text-center font-mono text-data-xs text-[var(--faint)]">waiting for agents\u2026</div>}
        {events.map((e: LiveEvent) => (
          <div key={e.id} className="flex animate-slide-in-top items-center gap-2 rounded-sm border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colorForKind(e.kind) }} />
            <span className="w-[96px] shrink-0 font-mono text-data-xs font-bold" style={{ color: colorForKind(e.kind) }}>{e.kind}</span>
            <span className="shrink-0 font-mono text-[9.5px] text-[var(--faint)]">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className="truncate font-mono text-data-sm text-[var(--ink)]">{e.actor ?? 'system'}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
