// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// ACTIVITY HEATMAP — 7 days × 12 hours synthetic activity grid. Color intensity
// tracks event density per hour. Click a cell for a breakdown tooltip.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel } from '@/components/ui';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00 → 19:00

// Deterministic pseudo-density so the grid looks alive without flickering.
function density(day: number, hour: number): number {
  const x = Math.sin(day * 31.7 + hour * 7.3) * 10000;
  const f = x - Math.floor(x); // 0..1
  // Bias toward midday on weekdays.
  const midday = 1 - Math.abs(hour - 13) / 8;
  const weekday = day < 5 ? 1 : 0.4;
  return Math.max(0, Math.min(1, f * 0.6 + midday * 0.25 + weekday * 0.15));
}

export function ActivityHeatmap() {
  const [cell, setCell] = React.useState<{ d: number; h: number } | null>(null);
  return (
    <Panel title="Activity Heatmap · last 7 days" action={<span className="font-mono text-[9.5px] text-[var(--faint)]">events / hour</span>}>
      <div className="overflow-x-auto scroll-thin">
        <div className="grid grid-cols-[36px_repeat(12,1fr)] gap-1">
          <div />
          {HOURS.map((h) => (
            <div key={h} className="text-center font-mono text-[8.5px] text-[var(--faint)]">{h}</div>
          ))}
          {DAYS.map((d, di) => (
            <React.Fragment key={d}>
              <div className="flex items-center font-mono text-[9px] font-bold text-[var(--dim)]">{d}</div>
              {HOURS.map((h) => {
                const v = density(di, h);
                const isCell = cell?.d === di && cell?.h === h;
                return (
                  <button
                    key={h}
                    onMouseEnter={() => setCell({ d: di, h })}
                    onMouseLeave={() => setCell(null)}
                    className="aspect-square rounded-[3px] transition-transform hover:scale-110"
                    style={{
                      background: v < 0.05 ? 'var(--paper2)' : `color-mix(in oklab, var(--rust) ${Math.round(v * 60)}%, var(--paper))`,
                      outline: isCell ? '1.5px solid var(--rust)' : 'none',
                      outlineOffset: 0,
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[9.5px] text-[var(--faint)]">
          <span>less</span>
          <div className="flex gap-1">
            {[0.05, 0.2, 0.4, 0.6].map((p) => (
              <span key={p} className="h-2 w-4 rounded-[2px]" style={{ background: `color-mix(in oklab, var(--rust) ${Math.round(p * 60)}%, var(--paper))` }} />
            ))}
          </div>
          <span>more</span>
        </div>
      </div>
    </Panel>
  );
}
