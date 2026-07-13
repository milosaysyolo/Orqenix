// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT NETWORK — SVG hub-and-spoke visualization (Canvas pillar, kept SVG per
// the Hybrid decision). The critical upgrade: pulses are **directional and
// correlated** — the `actor` field from the event stream identifies which
// subagent the pulse targets (no more `Math.random()`).
//
//   lead (center, teal) ←→ subagents (orbital, plum)
//   Edge pulse travels FROM lead TO the named subagent on `subagent.spawned`
//   or `agent.message`, and FROM the named subagent TO lead on
//   `subagent.returned`.
// ============================================================================

'use client';

import * as React from 'react';
import type { LiveEvent } from '@/lib/use-live-events';

interface Sub { session_id: string; agent_name: string; state: string; }

const STATE_COLOR: Record<string, string> = {
  running: 'var(--olive)', idle: 'var(--dim)', error: 'var(--rust)', paused: 'var(--amber)', completed: 'var(--slate)',
};

export function AgentNetwork({ subs, events }: { subs: Sub[]; events: LiveEvent[] }) {
  const W = 640, H = 500, cx = W / 2, cy = H / 2;

  const subPos = React.useMemo(() => {
    return subs.map((_, i) => {
      const a = (i / Math.max(1, subs.length)) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(a) * 170, y: cy + Math.sin(a) * 150 };
    }) as Array<{ x: number; y: number }>;
  }, [subs.length]);

  // Directional pulse state: which subagent index is receiving a pulse, and
  // whether it's outbound (lead→sub) or inbound (sub→lead).
  const [pulse, setPulse] = React.useState<{ idx: number; direction: 'out' | 'in' } | null>(null);

  // Track the latest relevant event to drive the pulse.
  React.useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    const kind = last.kind;
    const actor = last.actor;

    if ((kind === 'subagent.spawned' || kind === 'agent.message') && actor) {
      // Outbound: lead → specific subagent.
      const idx = subs.findIndex((s) => s.agent_name === actor);
      if (idx !== -1) {
        setPulse({ idx, direction: 'out' });
        const t = setTimeout(() => setPulse(null), 900);
        return () => clearTimeout(t);
      }
    }

    if (kind === 'subagent.returned' && actor) {
      // Inbound: specific subagent → lead.
      const idx = subs.findIndex((s) => s.agent_name === actor);
      if (idx !== -1) {
        setPulse({ idx, direction: 'in' });
        const t = setTimeout(() => setPulse(null), 900);
        return () => clearTimeout(t);
      }
    }
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (subs.length === 0) {
    return <div className="grid h-full place-items-center font-mono text-[11px] text-[var(--faint)]">No active run.</div>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      <defs>
        <filter id="glow-teal"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="glow-rust"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="glow-plum"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Edges + pulse animation */}
      {subs.map((sub, i) => {
        const p = subPos[i]!;
        const isActive = pulse?.idx === i;
        const edgeColor = isActive ? 'var(--rust)' : 'var(--line2)';
        const edgeWidth = isActive ? 2.4 : 1.4;

        return (
          <g key={sub.session_id}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke={edgeColor} strokeWidth={edgeWidth}
              style={isActive ? { filter: 'url(#glow-rust)' } : undefined} />
            {/* Animated pulse dot traveling along the edge */}
            {isActive && (
              <circle r={5} fill="var(--amber)" filter="url(#glow-rust)">
                {pulse.direction === 'out' ? (
                  <>
                    <animate attributeName="cx" from={cx} to={p.x} dur="0.8s" />
                    <animate attributeName="cy" from={cy} to={p.y} dur="0.8s" />
                  </>
                ) : (
                  <>
                    <animate attributeName="cx" from={p.x} to={cx} dur="0.8s" />
                    <animate attributeName="cy" from={p.y} to={cy} dur="0.8s" />
                  </>
                )}
              </circle>
            )}
          </g>
        );
      })}

      {/* Lead agent (center) */}
      <g transform={`translate(${cx},${cy})`}>
        <circle r={34} fill="var(--card)" stroke="var(--teal)" strokeWidth={2.6}
          style={{ filter: 'url(#glow-teal)' }} />
        <text textAnchor="middle" dy={-2} className="font-mono font-bold" style={{ fontSize: 10, fill: 'var(--ink)' }}>claude-code</text>
        <text textAnchor="middle" dy={11} className="font-mono" style={{ fontSize: 8, fill: 'var(--teal)' }}>lead</text>
      </g>

      {/* Subagents (orbital) */}
      {subs.map((sub, i) => {
        const p = subPos[i]!;
        const isPulseTarget = pulse?.idx === i;
        return (
          <g key={sub.session_id} transform={`translate(${p.x},${p.y})`}>
            <circle r={24} fill="var(--card)" stroke="var(--plum)" strokeWidth={2.2}
              style={isPulseTarget ? { filter: 'url(#glow-plum)' } : undefined} />
            <text textAnchor="middle" dy={-1} className="font-mono font-bold" style={{ fontSize: 8.5, fill: 'var(--ink)' }}>{sub.agent_name}</text>
            <text textAnchor="middle" dy={9} className="font-mono" style={{ fontSize: 7, fill: STATE_COLOR[sub.state] ?? 'var(--dim)' }}>{sub.state}</text>
          </g>
        );
      })}
    </svg>
  );
}
