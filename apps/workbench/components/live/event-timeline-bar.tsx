// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// EVENT TIMELINE BAR — Live Monitoring pillar. A compact horizontal timeline
// shown at the top of every screen (mounted in AppShell). Color-coded event
// dots, hover tooltip, click → detail panel, pause/resume.
// ============================================================================

'use client';

import * as React from 'react';
import { useLiveEvents, type LiveEvent } from '@/lib/use-live-events';

const KIND_COLOR: Record<string, string> = {
  'runtime.ready': 'var(--olive)',
  'memory.write': 'var(--teal)',
  'query.stage': 'var(--amber)',
  'session.started': 'var(--plum)',
  'session.updated': 'var(--amber)',
  'session.ended': 'var(--slate)',
  'subagent.spawned': 'var(--rust)',
  'subagent.returned': 'var(--olive)',
  'agent.message': 'var(--slate)',
  'agent.status': 'var(--teal)',
  'learning.candidate': 'var(--amber)',
  'audit.appended': 'var(--olive)',
  log: 'var(--dim)',
};

export function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? 'var(--faint)';
}

export function EventTimelineBar() {
  const { events, latest } = useLiveEvents(undefined, 60);
  const [paused, setPaused] = React.useState(false);
  const [detail, setDetail] = React.useState<LiveEvent | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const seenRef = React.useRef(events.length);

  // Auto-scroll to the right as new events arrive (unless paused).
  React.useEffect(() => {
    if (paused) return;
    seenRef.current = events.length;
    if (railRef.current) railRef.current.scrollLeft = railRef.current.scrollWidth;
  }, [events.length, paused]);

  // Clicking the latest event surfaces its detail once.
  React.useEffect(() => { if (!paused) setDetail(null); /* keep rail primary */ }, [latest, paused]);

  const shown = paused ? events.slice(0, seenRef.current) : events;
  const newCount = events.length - seenRef.current;

  return (
    <div className="relative flex h-9 items-center gap-2 border-b border-[var(--line)] bg-[var(--paper)] px-4">
      <span className="font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--faint)]">timeline</span>
      <div ref={railRef} className="scroll-thin relative flex flex-1 items-center gap-1.5 overflow-x-auto px-1">
        {shown.length === 0 && <span className="font-mono text-[10px] text-[var(--faint)]">waiting for events…</span>}
        {shown.map((e) => {
          const isDetail = detail?.id === e.id;
          return (
            <button
              key={e.id}
              onClick={() => setDetail(isDetail ? null : e)}
              title={`${e.kind} · ${e.actor ?? 'system'} · ${new Date(e.ts).toLocaleTimeString()}`}
              className="group relative grid h-5 shrink-0 place-items-center"
            >
              <span
                className={'block rounded-full transition-transform ' + (isDetail ? 'h-2.5 w-2.5 ring-2 ring-[var(--rust)] ring-offset-1 ring-offset-[var(--paper)]' : 'h-1.5 w-1.5 group-hover:scale-150')}
                style={{ background: colorForKind(e.kind) }}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => { setPaused((p) => !p); }}
        className="flex items-center gap-1 rounded-[6px] border border-[var(--line2)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--dim)] hover:text-[var(--ink)]"
        title="Pause / resume timeline (Space)"
      >
        {paused ? `\u25B6 resume` : `\u275A\u275A pause`}
        {paused && newCount > 0 && <span className="ml-1 rounded-full bg-[var(--rust)] px-1 text-[9px] text-[var(--paper)]">+{newCount}</span>}
      </button>

      {detail && (
        <div className="absolute right-4 top-11 z-30 w-[280px] animate-scale-in rounded-[10px] border border-[var(--line2)] bg-[var(--card)] p-3 shadow-[0_12px_30px_rgba(35,36,31,0.14)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wide" style={{ color: colorForKind(detail.kind) }}>{detail.kind}</span>
            <button onClick={() => setDetail(null)} className="font-mono text-[11px] text-[var(--faint)] hover:text-[var(--ink)]">{'\u00D7'}</button>
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--faint)]">{new Date(detail.ts).toLocaleTimeString()} · {detail.actor ?? 'system'}</div>
          {detail.correlationId && <div className="font-mono text-[10px] text-[var(--dim)]">corr: {detail.correlationId}</div>}
          <pre className="mt-2 max-h-[120px] overflow-auto scroll-thin whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-[var(--dim)]">{JSON.stringify(detail.payload, null, 1)}</pre>
        </div>
      )}
    </div>
  );
}
