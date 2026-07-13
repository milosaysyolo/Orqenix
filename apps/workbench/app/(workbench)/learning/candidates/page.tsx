'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Candidate {
  id: string; patternName: string; patternDescription: string;
  occurrenceCount: number; successRate: number; impactScore: number;
  estTimeSavedPerWeekMin: number; status: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ candidates: Candidate[] }>('/api/learning/candidates');
    if (res.ok) setCandidates(res.data!.candidates);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function review(id: string, action: 'promote' | 'reject' | 'defer') {
    const res = await api.post<{ ok: boolean; generatedSkillName?: string }>('/api/learning/candidates', { candidateId: id, action });
    if (res.ok) {
      setNote(res.data?.generatedSkillName ? `promoted -> ${res.data.generatedSkillName}` : `${action} ok`);
      await load();
    } else setNote(res.error ?? 'failed');
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <SectionTitle sub="Review and promote self-learned patterns">Candidate Patterns</SectionTitle>

      <Card className="mt-4 p-3 border-[color-mix(in_oklab,var(--amber)35%,transparent)] bg-[color-mix(in_oklab,var(--amber)4%,var(--card))]">
        <div className="font-mono text-[10.5px] text-[var(--dim)]">
          Promoted skills require verification (Anti-pattern 38). A promoted skill is created as <strong>unverified</strong> and must pass replay + cross-validation.
        </div>
      </Card>

      {note && <div className="mt-2 font-mono text-[10px] text-[var(--olive)]">{note}</div>}

      <div className="mt-4 space-y-3">
        {candidates.filter((c) => c.status === 'pending').length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
            No pending candidates. All patterns have been reviewed or none detected yet.
          </Card>
        ) : candidates.filter((c) => c.status === 'pending').map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-[var(--amber)]">{'\u2726'}</span>
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{c.patternName}</span>
              <Badge tone="rust">impact {c.impactScore.toFixed(1)}</Badge>
            </div>
            <p className="mt-1 text-[12px] text-[var(--dim)]">{c.patternDescription}</p>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-[var(--dim)]">
              <span>{c.occurrenceCount}x observed</span>
              <span>&middot;</span>
              <span>{Math.round(c.successRate * 100)}% success</span>
              <span>&middot;</span>
              <span>~{c.estTimeSavedPerWeekMin} min/week saved</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" onClick={() => review(c.id, 'promote')}>Promote</Button>
              <Button variant="ghost" size="sm" onClick={() => review(c.id, 'defer')}>Defer</Button>
              <Button variant="ghost" size="sm" onClick={() => review(c.id, 'reject')}>Reject</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
