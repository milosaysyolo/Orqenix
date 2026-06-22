// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/context-pipeline.tsx
// Purpose: The hero "Live Context Assembly" pipeline from the landing page,
//   reimplemented as a live React component. 6 stages: recall->distill->sign->
//   rerank->inject->send. Driven by SSE 'query.stage' events; falls back to a demo
//   autoplay loop when idle so the screen is never dead.
// Rules: 'use client'. Use useLiveEvents(['query.stage']). Active stage glows
//   rust, done stages olive. Show per-stage metrics. Match landing page styling.
// ============================================================================

'use client';

import * as React from 'react';
import { useLiveEvents } from '@/lib/use-live-events';
import { Card, LiveDot } from '@/components/ui';

const STAGES = [
  { key: 'recall', n: '01', label: 'recall' },
  { key: 'distill', n: '02', label: 'distill' },
  { key: 'sign', n: '03', label: 'sign' },
  { key: 'rerank', n: '04', label: 'rerank' },
  { key: 'inject', n: '05', label: 'inject' },
  { key: 'send', n: '06', label: 'send' },
] as const;

interface StageState { active: number; metrics: Record<string, string>; prompt: string; rid: string; }

const DEMO_METRICS: Record<string, string> = {
  recall: '742 cand · 248ms', distill: '1240->132 tok', sign: 'Ed25519 · 7',
  rerank: 'top 0.94', inject: '4192/8192', send: 'opus · stream',
};

export function ContextPipeline() {
  const { connected, latest } = useLiveEvents(['query.stage']);
  const [state, setState] = React.useState<StageState>({
    active: -1, metrics: {}, prompt: 'how does our JWT refresh flow handle rotation?', rid: '#1042',
  });

  // React to live query.stage events.
  React.useEffect(() => {
    if (!latest || latest.kind !== 'query.stage') return;
    const stage = String(latest.payload.stage ?? '');
    const idx = STAGES.findIndex((s) => s.key === stage);
    if (idx === -1) return;
    setState((prev) => ({
      ...prev,
      active: idx,
      metrics: { ...prev.metrics, [stage]: String(latest.payload.metric ?? '') },
      prompt: String(latest.payload.prompt ?? prev.prompt),
      rid: String(latest.payload.rid ?? prev.rid),
    }));
  }, [latest]);

  // Demo autoplay when no live activity (so the hero always feels alive).
  React.useEffect(() => {
    if (connected && state.active >= 0) return;
    let i = 0;
    const t = setInterval(() => {
      setState((prev) => ({ ...prev, active: i % 6, metrics: DEMO_METRICS }));
      i++;
    }, 900);
    return () => clearInterval(t);
  }, [connected, state.active]);

  return (
    <Card className="p-5">
      {/* Prompt request bar */}
      <div className="mb-4 flex items-center gap-3 rounded-[9px] border border-[var(--line2)] bg-[var(--paper)] px-4 py-3">
        <LiveDot on={connected} />
        <span className="font-mono text-[11px] font-extrabold text-[var(--plum)]">prompt ›</span>
        <span className="flex-1 truncate font-mono text-[13px] font-semibold text-[var(--ink)]">{state.prompt}</span>
        <span className="font-mono text-[10.5px] font-bold text-[var(--dim)]">req {state.rid}</span>
      </div>

      {/* 6-stage pipeline */}
      <div className="grid grid-cols-6 gap-2">
        {STAGES.map((s, i) => {
          const isActive = i === state.active;
          const isDone = i < state.active;
          return (
            <div
              key={s.key}
              className="relative overflow-hidden rounded-[9px] border px-2 py-2.5 text-center transition-all"
              style={{
                borderColor: isActive ? 'var(--rust)' : isDone ? 'color-mix(in oklab, var(--olive) 50%, transparent)' : 'var(--line)',
                background: isActive ? 'color-mix(in oklab, var(--rust) 7%, var(--paper))' : isDone ? 'color-mix(in oklab, var(--olive) 5%, var(--paper))' : 'var(--paper)',
                boxShadow: isActive ? '0 0 0 2px color-mix(in oklab, var(--rust) 20%, transparent)' : 'none',
              }}
            >
              <div className="font-mono text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--amber)]">{s.n}</div>
              <div className="mt-1 font-mono text-[11.5px] font-extrabold text-[var(--ink)]">{s.label}</div>
              <div className="mt-1 font-mono text-[9.5px] text-[var(--dim)]">{state.metrics[s.key] ?? '—'}</div>
              {i < STAGES.length - 1 && (
                <span className="absolute right-[-7px] top-1/2 -translate-y-1/2 text-[11px] text-[var(--faint)]">→</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
