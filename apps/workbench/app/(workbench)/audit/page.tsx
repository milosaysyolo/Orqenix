'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface AuditEntry { ts: string; hash: string; valid: boolean; action?: string; actor?: string; }

export default function AuditPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [verification, setVerification] = React.useState<{ valid: boolean; entriesVerified: number } | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ entries: AuditEntry[]; verification: { valid: boolean; entriesVerified: number } }>('/api/audit');
    if (res.ok) { setEntries(res.data!.entries); setVerification(res.data!.verification); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Tamper-evident hash chain">Audit Log</SectionTitle>
        <Button variant="outline" size="sm" onClick={load}>{'\u21BB'} Verify Chain</Button>
      </div>

      {verification && (
        <Card className="mt-4 p-3">
          <div className="flex items-center gap-2 font-mono text-[11px]"
            style={{ color: verification.valid ? 'var(--olive)' : 'var(--rust)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: verification.valid ? 'var(--olive)' : 'var(--rust)' }} />
            {verification.valid
              ? `Chain valid \u00B7 ${verification.entriesVerified} entries verified`
              : 'Chain integrity compromised'}
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-1.5">
        {entries.length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">No audit entries yet.</Card>
        ) : entries.map((e, i) => (
          <div key={`${e.ts}-${i}`} className="flex items-center gap-3 rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-4 py-2">
            <span className={'h-1.5 w-1.5 rounded-full ' + (e.valid ? 'bg-[var(--olive)]' : 'bg-[var(--rust)]')} />
            {e.action && <Badge tone="neutral">{e.action}</Badge>}
            <span className="font-mono text-[10px] text-[var(--dim)]">{e.actor ?? 'system'}</span>
            <span className="ml-auto font-mono text-[9.5px] text-[var(--faint)]">{e.hash?.slice(0, 16)}&hellip;</span>
            <span className="font-mono text-[9.5px] text-[var(--dim)]">{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
