'use client';

import * as React from 'react';
import type { LiveEvent } from '@/lib/use-live-events';

interface Session { session_id: string; agent_name: string; state: string; subagents?: Session[]; }

export function AgentNetwork({ sessions, events }: { sessions: Session[]; events: LiveEvent[] }) {
  const lead = sessions[0];
  const subs = lead?.subagents ?? [];
  const W = 600, H = 480, cx = W / 2, cy = H / 2;

  const subPos = subs.map((_, i) => {
    const a = (i / Math.max(1, subs.length)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 130 };
  }) as Array<{ x: number; y: number }>;

  const [pulseIdx, setPulseIdx] = React.useState<number | null>(null);
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;
    if (last.kind === 'subagent.spawned' || last.kind === 'agent.message') {
      const idx = Math.floor(Math.random() * Math.max(1, subs.length));
      setPulseIdx(idx);
      const t = setTimeout(() => setPulseIdx(null), 900);
      return () => clearTimeout(t);
    }
  }, [events.length]);

  if (!lead) {
    return <div className="grid h-full place-items-center font-mono text-[11px] text-[var(--faint)]">No active run.</div>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {subs.map((sub, i) => {
        const p = subPos[i]!;
        const active = pulseIdx === i;
        return (
          <g key={sub.session_id}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={active ? 'var(--rust)' : 'var(--line2)'} strokeWidth={active ? 2.4 : 1.4}
              style={active ? { filter: 'drop-shadow(0 0 4px var(--rust))' } : undefined} />
            {active && (
              <circle r={4} fill="var(--amber)">
                <animate attributeName="cx" from={cx} to={p.x} dur="0.8s" />
                <animate attributeName="cy" from={cy} to={p.y} dur="0.8s" />
              </circle>
            )}
          </g>
        );
      })}
      <g transform={`translate(${cx},${cy})`}>
        <circle r={32} fill="var(--card)" stroke="var(--teal)" strokeWidth={2.6}
          style={{ filter: 'drop-shadow(0 0 8px var(--teal))' }} />
        <text textAnchor="middle" dy={-2} className="font-mono font-bold" style={{ fontSize: 10, fill: 'var(--ink)' }}>{lead.agent_name}</text>
        <text textAnchor="middle" dy={11} className="font-mono" style={{ fontSize: 8, fill: 'var(--teal)' }}>lead</text>
      </g>
      {subs.map((sub, i) => {
        const p = subPos[i]!;
        return (
          <g key={sub.session_id} transform={`translate(${p.x},${p.y})`}>
            <circle r={22} fill="var(--card)" stroke="var(--plum)" strokeWidth={2.2} />
            <text textAnchor="middle" dy={-1} className="font-mono font-bold" style={{ fontSize: 8.5, fill: 'var(--ink)' }}>{sub.agent_name}</text>
            <text textAnchor="middle" dy={9} className="font-mono" style={{ fontSize: 7, fill: 'var(--dim)' }}>{sub.state}</text>
          </g>
        );
      })}
    </svg>
  );
}
