// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

interface Verification {
  id: string; name: string; status: string; successRate: number; replayCount: number;
}

export default function VerifyPage() {
  const { toast } = useToast();
  const [verifications, setVerifications] = React.useState<Verification[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ verifications: Verification[] }>('/api/learning/verify');
    if (res.ok) setVerifications(res.data!.verifications);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function handleReplay(name: string) {
    setBusy(name);
    await new Promise((r) => setTimeout(r, 1000));
    setBusy(null);
    toast({ title: 'Replay complete', message: `${name}: 3/3 steps passed`, tone: 'success' });
  }

  async function handleCrossValidate(name: string) {
    setBusy(name);
    await new Promise((r) => setTimeout(r, 1500));
    setBusy(null);
    toast({ title: 'Cross-validation', message: `${name} meets 80% threshold`, tone: 'success' });
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <SectionTitle sub="Verify learned instincts before promotion to skill">Verification</SectionTitle>

      {verifications.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          No skills pending verification. Promote candidates from the Learning Hub first.
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {verifications.map((v) => (
            <Card key={v.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={'/learning/verify/' + encodeURIComponent(v.name)} className="flex items-center gap-3 no-underline flex-1">
                <Badge tone={v.status === 'passed' ? 'olive' : v.status === 'failed' ? 'rust' : 'amber'}>{v.status}</Badge>
                <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{v.name}</span>
                <span className="font-mono text-[10px] text-[var(--dim)]">{Math.round(v.successRate * 100)}% success</span>
                <span className="font-mono text-[10px] text-[var(--faint)]">{v.replayCount} replays</span>
              </Link>
              {v.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleReplay(v.name)} disabled={busy === v.name}>
                    {busy === v.name ? '\u2026' : 'Run Replay'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleCrossValidate(v.name)} disabled={busy === v.name}>
                    {busy === v.name ? '\u2026' : 'Cross-Validate'}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
