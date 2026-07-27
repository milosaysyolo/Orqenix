// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { Panel } from '@/components/ui';
import { useLiveEvents, type LiveEvent } from '@/lib/use-live-events';
import { colorForKind } from '@/components/live/event-timeline-bar';

const KIND_COLOR: Record<string, string> = {
  'query.stage': 'var(--teal)', 'session.started': 'var(--plum)', 'session.updated': 'var(--amber)',
  'session.ended': 'var(--slate)', 'subagent.spawned': 'var(--rust)', 'subagent.returned': 'var(--olive)',
  'agent.message': 'var(--slate)', 'agent.status': 'var(--teal)', 'audit.appended': 'var(--olive)',
  'runtime.ready': 'var(--olive)', 'memory.write': 'var(--teal)', 'learning.candidate': 'var(--amber)',
  log: 'var(--dim)',
};

export function RunLogs() {
  const { events, connected } = useLiveEvents(undefined, 120);
  const [follow, setFollow] = React.useState(true);
  const [filter, setFilter] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events.length, follow]);

  const shown = filter.size > 0 ? events.filter((e) => filter.has(e.kind)) : events;

  function toggleFilter(kind: string) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }

  const uniqueKinds = React.useMemo(() => [...new Set(events.map((e) => e.kind))], [events]);

  return (
    <Panel title="Logs" action={
      <label className="flex items-center gap-1 font-mono text-[9.5px] text-[var(--dim)]">
        follow <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
      </label>
    }>
      {/* Filter chips */}
      <div className="mb-2 flex flex-wrap gap-1">
        {uniqueKinds.map((kind) => (
          <button
            key={kind}
            onClick={() => toggleFilter(kind)}
            className={'rounded-[5px] px-1.5 py-0.5 font-mono text-[9px] font-bold transition-colors ' +
              (filter.has(kind)
                ? ''
                : 'opacity-40 hover:opacity-70')}
            style={filter.has(kind)
              ? { color: KIND_COLOR[kind] ?? 'var(--dim)', background: `color-mix(in oklab, ${KIND_COLOR[kind] ?? 'var(--dim)'} 14%, transparent)` }
              : undefined}
          >{kind}</button>
        ))}
        {filter.size > 0 && (
          <button onClick={() => setFilter(new Set())} className="font-mono text-[9px] text-[var(--faint)] hover:text-[var(--ink)]">clear</button>
        )}
      </div>

      <div ref={ref} className="h-[220px] overflow-y-auto scroll-thin font-mono text-[10px] leading-relaxed">
        {shown.length === 0 ? (
          <div className="py-6 text-center text-[var(--faint)]">{connected ? 'waiting for events\u2026' : 'connecting\u2026'}</div>
        ) : shown.map((e: LiveEvent) => (
          <div key={e.id} className="flex gap-2 hover:bg-[color-mix(in_oklab,var(--paper2)_60%,transparent)]">
            <span className="shrink-0 text-[var(--faint)]">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className="w-[120px] shrink-0 font-bold" style={{ color: colorForKind(e.kind) }}>{e.kind}</span>
            <span className="w-[70px] shrink-0 text-[var(--dim)]">{e.actor ?? '—'}</span>
            <span className="truncate text-[var(--ink)]">{JSON.stringify(e.payload).slice(0, 50)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
