'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface AuditEntry { seq: number; ts: string; kind: string; actor: string; hash: string; }
interface Verification { valid: boolean; firstMismatchSeq: number | null; entriesVerified: number; }

const PAGE = 50;

export default function AuditPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [verification, setVerification] = React.useState<Verification | null>(null);
  const [offset, setOffset] = React.useState(0);

  const load = React.useCallback(async () => {
    const res = await api.get<{ entries: AuditEntry[]; verification: Verification }>(`/api/audit?offset=${offset}&limit=${PAGE}`);
    if (res.ok) { setEntries(res.data!.entries); setVerification(res.data!.verification); }
  }, [offset]);
  React.useEffect(() => { void load(); }, [load]);

  async function verify() {
    const res = await api.post<{ valid: boolean }>('/api/audit', { action: 'verify' });
    if (res.ok) await load();
  }

  const kindTone = (k: string) =>
    k.startsWith('memory.write') ? 'teal' : k.startsWith('subagent') ? 'plum' : k.startsWith('session') ? 'amber' : k.startsWith('marketplace') ? 'olive' : 'neutral';

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Tamper-evident BLAKE3 hash chain">Audit Log</SectionTitle>
        <Button variant="outline" size="sm" onClick={verify}>↻ Verify Chain</Button>
      </div>

      {verification && (
        <Card className="mt-4 p-3" >
          <div className="flex items-center gap-2 font-mono text-[11px]"
            style={{ color: verification.valid ? 'var(--olive)' : 'var(--rust)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: verification.valid ? 'var(--olive)' : 'var(--rust)' }} />
            {verification.valid
              ? `Chain valid · ${verification.entriesVerified} entries verified`
              : `Chain BROKEN at seq ${verification.firstMismatchSeq}`}
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-1.5">
        {entries.length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">No audit entries yet.</Card>
        ) : entries.map((e) => (
          <div key={e.seq} className="flex items-center gap-3 rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-4 py-2">
            <span className="font-mono text-[10px] font-bold text-[var(--faint)]">#{e.seq}</span>
            <Badge tone={kindTone(e.kind) as never}>{e.kind}</Badge>
            <span className="font-mono text-[10px] text-[var(--dim)]">{e.actor}</span>
            <span className="ml-auto font-mono text-[9.5px] text-[var(--faint)]">{e.hash.slice(0, 16)}…</span>
            <span className="font-mono text-[9.5px] text-[var(--dim)]">{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>← prev</Button>
        <span className="font-mono text-[10px] text-[var(--dim)]">offset {offset}</span>
        <Button variant="ghost" size="sm" disabled={entries.length < PAGE} onClick={() => setOffset((o) => o + PAGE)}>next →</Button>
      </div>
    </div>
  );
}
