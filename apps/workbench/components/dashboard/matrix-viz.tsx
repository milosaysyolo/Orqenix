// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// MATRIX VIZ — compact 4×4 KB×Tier heat grid for the dashboard.
// Cells are small squares, no legend (saves space), extra "explore" link.
// ============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import { useLiveEvents } from '@/lib/use-live-events';

const KBS = ['chat', 'code', 'decision', 'lesson'] as const;
const TIERS = ['T1', 'T2', 'T3', 'T4'] as const;
const KB_COLOR: Record<string, string> = { chat: 'var(--amber)', code: 'var(--teal)', decision: 'var(--plum)', lesson: 'var(--slate)' };

export function MatrixViz({ matrix: initialMatrix }: { matrix: Record<string, Record<string, number>> }) {
  const router = useRouter();
  const { latest } = useLiveEvents(['memory.write']);
  const [flash, setFlash] = React.useState<Set<string>>(new Set());

  const [cells, setCells] = React.useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const t of TIERS) for (const k of KBS) m[`${t}:${k}`] = initialMatrix[t]?.[k] ?? 0;
    return m;
  });

  React.useEffect(() => {
    if (!latest || latest.kind !== 'memory.write') return;
    const kb = String(latest.payload.kb ?? '');
    const cells = new Set<string>();
    if (kb && KBS.includes(kb as (typeof KBS)[number])) {
      TIERS.forEach((t) => cells.add(`${t}:${kb}`));
    } else {
      cells.add(`${TIERS[Math.floor(Math.random() * TIERS.length)]}:${KBS[Math.floor(Math.random() * KBS.length)]}`);
    }
    setFlash(cells);
    const t = setTimeout(() => setFlash(new Set()), 700);
    return () => clearTimeout(t);
  }, [latest]);

  const max = React.useMemo(() => {
    let m = 1;
    for (const t of TIERS) for (const k of KBS) m = Math.max(m, cells[`${t}:${k}`] ?? 0);
    return m;
  }, [cells]);

  const total = React.useMemo(() => {
    let s = 0;
    for (const t of TIERS) for (const k of KBS) s += cells[`${t}:${k}`] ?? 0;
    return s;
  }, [cells]);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dim)]">Matrix</span>
          <span className="font-mono text-[8.5px] text-[var(--faint)]">{total} entries</span>
        </div>
        <button
          onClick={() => router.push('/memory')}
          className="font-mono text-[8.5px] text-[var(--faint)] underline underline-offset-2 decoration-[var(--line)] hover:text-[var(--rust)] transition-colors"
        >
          full view {'\u2192'}
        </button>
      </div>

      <div className="grid grid-cols-[22px_repeat(4,1fr)] gap-[2px]">
        <div />
        {KBS.map((k) => (
          <div key={k} className="text-center leading-none">
            <span className="font-mono text-[7px] font-bold uppercase" style={{ color: KB_COLOR[k] }}>{k.slice(0, 2)}</span>
          </div>
        ))}
        {TIERS.map((t) => (
          <React.Fragment key={t}>
            <div className="flex items-center justify-center">
              <span className="font-mono text-[7px] font-bold text-[var(--faint)]">{t}</span>
            </div>
            {KBS.map((k) => {
              const key = `${t}:${k}`;
              const v = cells[key] ?? 0;
              const intensity = max > 0 ? v / max : 0;
              return (
                <button
                  key={key}
                  onClick={() => router.push('/memory')}
                  title={`${t} · ${k}: ${v} entries`}
                  className={`aspect-square rounded-sm border transition-all duration-150 hover:scale-110 hover:z-10 ${
                    flash.has(key) ? 'animate-cell-flash' : ''
                  }`}
                  style={{
                    borderColor: v > 0 ? `color-mix(in oklab, ${KB_COLOR[k]} 30%, transparent)` : 'var(--line)',
                    background: v > 0
                      ? `color-mix(in oklab, ${KB_COLOR[k]} ${6 + intensity * 30}%, var(--card))`
                      : 'var(--card)',
                  }}
                >
                  {v > 0 && (
                    <span className="font-mono text-[8px] font-extrabold" style={{ color: KB_COLOR[k] }}>
                      {v}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}
