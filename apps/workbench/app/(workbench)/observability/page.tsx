'use client';

import * as React from 'react';
import { SectionTitle, Card, Stat } from '@/components/ui';
import { api } from '@/lib/api';

interface Obs {
  total: number; kbCounts: Record<string, number>;
  sessions: { active: number; total: number }; plugins: number; candidates: number; auditLen: number;
  latency: { queryMs: number; sloMs: number; pass: boolean };
}

export default function ObservabilityPage() {
  const [obs, setObs] = React.useState<Obs | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<Obs>('/api/observability');
    if (res.ok) setObs(res.data!);
  }, []);
  React.useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const kbMax = obs ? Math.max(1, ...Object.values(obs.kbCounts)) : 1;

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <SectionTitle sub="Metrics, latency, and memory distribution">Observability</SectionTitle>

      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
        <Stat label="Memory Entries" value={(obs?.total ?? 0).toLocaleString()} accent="teal" />
        <Stat label="Active Sessions" value={obs?.sessions.active ?? 0} accent="olive" />
        <Stat label="Total Sessions" value={obs?.sessions.total ?? 0} />
        <Stat label="Plugins" value={obs?.plugins ?? 0} accent="plum" />
        <Stat label="Candidates" value={obs?.candidates ?? 0} accent="amber" />
        <Stat label="Audit Entries" value={obs?.auditLen ?? 0} accent="slate" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-wide text-[var(--dim)]">KB distribution</div>
          {obs && Object.entries(obs.kbCounts).map(([kb, c]) => (
            <div key={kb} className="mb-2">
              <div className="flex justify-between font-mono text-[10.5px]"><span className="text-[var(--ink)]">{kb}</span><span className="text-[var(--dim)]">{c.toLocaleString()}</span></div>
              <div className="mt-1 h-2 rounded-full bg-[var(--paper2)]">
                <div className="h-full rounded-full" style={{ width: `${(c / kbMax) * 100}%`, background: kb === 'code' ? 'var(--teal)' : kb === 'decision' ? 'var(--plum)' : kb === 'chat' ? 'var(--amber)' : 'var(--slate)' }} />
              </div>
            </div>
          ))}
        </Card>

        <Card className="p-4">
          <div className="mb-3 font-mono text-[11px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Query latency vs SLO</div>
          {obs && (
            <>
              <div className="font-mono text-[28px] font-extrabold" style={{ color: obs.latency.pass ? 'var(--olive)' : 'var(--rust)' }}>
                {obs.latency.queryMs}ms
              </div>
              <div className="mt-1 font-mono text-[11px] text-[var(--dim)]">
                SLO &lt; {obs.latency.sloMs}ms &middot; {obs.latency.pass ? 'PASS \u2713' : 'FAIL \u2717'}
              </div>
              <div className="mt-3 h-3 rounded-full bg-[var(--paper2)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (obs.latency.queryMs / obs.latency.sloMs) * 100)}%`, background: obs.latency.pass ? 'var(--olive)' : 'var(--rust)' }} />
              </div>
              <div className="mt-1 font-mono text-[9.5px] text-[var(--faint)]">live timed engine.query()</div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
