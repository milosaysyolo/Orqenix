'use client';

import * as React from 'react';
import { Panel } from '@/components/ui';
import { useLiveEvents } from '@/lib/use-live-events';

const KIND_COLOR: Record<string, string> = {
  'query.stage': 'var(--teal)', 'session.started': 'var(--plum)', 'session.updated': 'var(--amber)',
  'subagent.spawned': 'var(--rust)', 'agent.message': 'var(--slate)', 'audit.appended': 'var(--olive)',
  log: 'var(--dim)', 'runtime.ready': 'var(--olive)',
};

export function RunLogs() {
  const { events, connected } = useLiveEvents(undefined, 120);
  const [follow, setFollow] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events.length, follow]);

  return (
    <Panel title="Logs" action={
      <label className="flex items-center gap-1 font-mono text-[9.5px] text-[var(--dim)]">
        follow
        <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
      </label>
    }>
      <div ref={ref} className="h-[220px] overflow-y-auto font-mono text-[10px] leading-relaxed">
        {events.length === 0 ? (
          <div className="py-6 text-center text-[var(--faint)]">{connected ? 'waiting for events&hellip;' : 'connecting&hellip;'}</div>
        ) : events.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 text-[var(--faint)]">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className="w-[110px] shrink-0 font-bold" style={{ color: KIND_COLOR[e.kind] ?? 'var(--dim)' }}>{e.kind}</span>
            <span className="truncate text-[var(--ink)]">{JSON.stringify(e.payload).slice(0, 60)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
