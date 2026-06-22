// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/matrix-viz.tsx
// Purpose: The 4x4 Memory Matrix (4 KBs x 4 tiers) from the landing page, fed by
//   real cell counts from /api/dashboard. Cell opacity scales with count. Hover
//   shows the count; click could deep-link to Memory Explorer (W2.B).
// Rules: 'use client'. Receives matrix prop (T1..T4 x chat/code/decision/lesson).
//   Colors: cells tinted teal (project scope feel). Match landing styling.
// ============================================================================

'use client';

import * as React from 'react';
import { Card } from '@/components/ui';

const KBS = ['chat', 'code', 'decision', 'lesson'] as const;
const KB_LABEL = ['ChatKB', 'CodeKB', 'DecisionKB', 'LessonKB'];
const TIERS = ['T1', 'T2', 'T3', 'T4'] as const;
const TIER_LABEL = ['Working', 'Episodic', 'Semantic', 'Global'];

export function MatrixViz({ matrix }: { matrix: Record<string, Record<string, number>> }) {
  const max = React.useMemo(() => {
    let m = 1;
    for (const t of TIERS) for (const k of KBS) m = Math.max(m, matrix[t]?.[k] ?? 0);
    return m;
  }, [matrix]);

  return (
    <Card className="p-4">
      <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
        Memory Matrix · 4 KB × 4 tier
      </div>
      <div className="grid grid-cols-[60px_1fr] gap-1">
        <div />
        <div className="grid grid-cols-4 gap-1">
          {KB_LABEL.map((l, i) => (
            <div key={l} className="text-center font-mono text-[9.5px] font-extrabold text-[var(--ink)]">
              {l}<div className="font-medium text-[8px] text-[var(--dim)]">{['RAG', 'graph', '13t', 'chain'][i]}</div>
            </div>
          ))}
        </div>
        {TIERS.map((t, ti) => (
          <React.Fragment key={t}>
            <div className="flex flex-col justify-center pr-2 text-right font-mono text-[9.5px] font-extrabold text-[var(--ink)]">
              {TIER_LABEL[ti]}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {KBS.map((k) => {
                const v = matrix[t]?.[k] ?? 0;
                const a = 0.08 + 0.34 * (v / max);
                return (
                  <div
                    key={k}
                    title={`${TIER_LABEL[ti]} × ${k} · ${v}`}
                    className="grid h-[42px] place-items-center rounded-[6px] border border-[var(--line2)] font-mono text-[12.5px] font-extrabold transition-all hover:scale-[1.05]"
                    style={{ background: `color-mix(in oklab, var(--teal) ${Math.round(a * 100)}%, var(--card))`, color: '#1a1714' }}
                  >
                    {v.toLocaleString()}
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}
