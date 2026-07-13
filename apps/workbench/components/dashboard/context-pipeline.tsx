// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// CONTEXT PIPELINE — live 6-stage context-assembly viz. The query.stage event
// stream drives which stage is active; completed stages get an olive tint.
// ============================================================================

'use client';

import * as React from 'react';
import { useLiveEvents } from '@/lib/use-live-events';
import { Card, LiveDot } from '@/components/ui';

const STAGES = [
  { key: 'recall', n: '01', label: 'Recall', icon: '\u2191' },
  { key: 'distill', n: '02', label: 'Distill', icon: '\u2193' },
  { key: 'sign', n: '03', label: 'Sign', icon: '\u2713' },
  { key: 'rerank', n: '04', label: 'Rerank', icon: '\u2606' },
  { key: 'inject', n: '05', label: 'Inject', icon: '\u2192' },
  { key: 'send', n: '06', label: 'Send', icon: '\u2197' },
] as const;

const DEMO_METRICS: Record<string, string> = {
  recall: '742 cand \u00B7 248ms', distill: '1240\u2192132 tok', sign: 'Ed25519 \u00B7 7',
  rerank: 'top 0.94', inject: '4192/8192', send: 'opus \u00B7 stream',
};

export function ContextPipeline() {
  const { connected, latest } = useLiveEvents(['query.stage']);
  const [active, setActive] = React.useState(-1);
  const [metrics, setMetrics] = React.useState<Record<string, string>>({});
  const [prompt, setPrompt] = React.useState('how does our JWT refresh flow handle rotation?');
  const [rid, setRid] = React.useState('#1042');
  const [sawLive, setSawLive] = React.useState(false);

  React.useEffect(() => {
    if (!latest || latest.kind !== 'query.stage') return;
    const stage = String(latest.payload.stage ?? '');
    const idx = STAGES.findIndex((s) => s.key === stage);
    if (idx === -1) return;
    if (!sawLive) setSawLive(true);
    setActive(idx);
    setMetrics((prev) => ({ ...prev, [stage]: String(latest.payload.metric ?? prev[stage] ?? '\u2014') }));
    if (latest.payload.prompt) setPrompt(String(latest.payload.prompt));
    if (latest.payload.rid) setRid(String(latest.payload.rid));
  }, [latest, sawLive]);

  React.useEffect(() => {
    if (sawLive) return;
    let i = 0;
    const t = setInterval(() => {
      setActive(i % STAGES.length);
      setMetrics(DEMO_METRICS);
      i++;
    }, 900);
    return () => clearInterval(t);
  }, [sawLive]);

  return (
    <Card className="p-4">
      {/* Prompt banner */}
      <div className="mb-4 flex items-center gap-3 rounded-md border border-[var(--line2)] bg-[var(--paper)] px-4 py-2.5">
        <LiveDot on={connected} />
        <span className="font-mono text-data-sm font-extrabold text-[var(--plum)]">prompt</span>
        <span className="flex-1 truncate font-mono text-data-base font-semibold text-[var(--ink)]">{prompt}</span>
        <span className="rounded-sm bg-[var(--paper2)] px-2 py-0.5 font-mono text-data-xs font-bold text-[var(--dim)]">{rid}</span>
      </div>

      {/* Pipeline stages */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => {
          const isActive = i === active;
          const isDone = active >= 0 && i < active;
          return (
            <div
              key={s.key}
              className="relative flex flex-col items-center rounded-md border px-2 py-3 transition-all duration-300 animate-fade-in"
              style={{
                animationDelay: `${i * 60}ms`,
                borderColor: isActive ? 'var(--rust)' : isDone ? 'color-mix(in oklab, var(--olive) 50%, transparent)' : 'var(--line)',
                background: isActive ? 'color-mix(in oklab, var(--rust) 7%, var(--paper))' : isDone ? 'color-mix(in oklab, var(--olive) 5%, var(--paper))' : 'var(--paper)',
                boxShadow: isActive ? '0 0 0 2px color-mix(in oklab, var(--rust) 20%, transparent)' : 'none',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-bold tracking-wider text-[var(--faint)]">{s.n}</span>
                <span className="text-[12px]" style={{ color: isActive ? 'var(--rust)' : isDone ? 'var(--olive)' : 'var(--faint)' }}>{s.icon}</span>
              </div>
              <div className="mt-1 font-mono text-[12px] font-extrabold text-[var(--ink)]">{s.label}</div>
              <div className="mt-1 font-mono text-[9px] text-[var(--dim)]">{metrics[s.key] ?? '\u2014'}</div>
              {isDone && <div className="mt-0.5 font-mono text-[9px] text-[var(--olive)]">{'\u2713'}</div>}
              {i < STAGES.length - 1 && (
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--faint)] hidden lg:block">{'\u2192'}</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
