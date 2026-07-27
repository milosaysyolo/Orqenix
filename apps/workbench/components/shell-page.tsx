// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SHELL PAGE — minimal but on-brand placeholder used by routes that get fully
// built later (Phase 2–6). Keeps the whole nav live and visually consistent,
// with a live element (the global timeline bar) present on every screen.
// ============================================================================

'use client';

import * as React from 'react';
import { SectionTitle, Panel, Card, LiveDot } from '@/components/ui';
import { useLiveEvents } from '@/lib/use-live-events';

export function ShellPage({
  title,
  sub,
  glyph,
  phase,
  children,
}: {
  title: string;
  sub: string;
  glyph: string;
  phase: string;
  children?: React.ReactNode;
}) {
  const { connected, latest } = useLiveEvents();
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionTitle sub={sub}>{title}</SectionTitle>
        <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--olive)]">
          <LiveDot on={connected} /> {connected ? 'live' : 'connecting…'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {children ?? (
            <Card className="grid min-h-[320px] place-items-center">
              <div className="text-center">
                <div className="font-mono text-[42px] text-[var(--rust)] opacity-30">{glyph}</div>
                <div className="mt-3 font-mono text-[12px] text-[var(--dim)]">{title} — scaffolded</div>
                <div className="mt-1 font-mono text-[10px] text-[var(--faint)]">{phase}</div>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Live Stream" action={<span className="font-mono text-[9.5px] text-[var(--olive)]">live</span>}>
            <div className="h-[200px] overflow-y-auto scroll-thin font-mono text-[10px] leading-relaxed">
              {!latest && <div className="py-6 text-center text-[var(--faint)]">waiting for events…</div>}
              {latest && (
                <div className="flex gap-2">
                  <span className="shrink-0 text-[var(--faint)]">{new Date(latest.ts).toLocaleTimeString()}</span>
                  <span className="font-bold text-[var(--rust)]">{latest.kind}</span>
                  <span className="truncate text-[var(--dim)]">{latest.actor ?? 'system'}</span>
                </div>
              )}
              <div className="mt-2 text-[var(--faint)]">latest event shown — open the timeline bar above for the full stream.</div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
