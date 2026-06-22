'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Candidate {
  id: string; patternName: string; patternDescription: string;
  occurrenceCount: number; successRate: number; impactScore: number;
  estTimeSavedPerWeekMin: number; status: string;
}

const STAGES = [
  { key: 'observe', label: 'Observe', tone: 'slate' as const },
  { key: 'detect', label: 'Detect', tone: 'amber' as const },
  { key: 'candidate', label: 'Candidates', tone: 'rust' as const },
  { key: 'verify', label: 'Verify', tone: 'olive' as const },
  { key: 'skill', label: 'Skills', tone: 'teal' as const },
];

export default function LearningPage() {
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [observer, setObserver] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ candidates: Candidate[] }>('/api/learning');
    if (res.ok) setCandidates(res.data!.candidates);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function review(id: string, action: 'promote' | 'promote_customize' | 'reject' | 'defer') {
    const res = await api.post<{ ok: boolean; openBuilder?: boolean; generatedSkillName?: string }>('/api/learning', { action, candidateId: id, reviewedBy: 'milo' });
    if (res.ok) {
      if (res.data?.openBuilder) { window.location.href = `/marketplace/new?fromCandidate=${id}`; return; }
      setNote(res.data?.generatedSkillName ? `promoted → ${res.data.generatedSkillName} (unverified)` : `${action} ok`);
      await load();
    } else setNote(res.error ?? 'failed');
  }

  async function toggleObserver() {
    const next = !observer;
    setObserver(next);
    await api.post('/api/learning/observer', { scope: 'project', id: 'current', enabled: next });
  }

  return (
    <div className="mx-auto max-w-[1300px] px-6 py-6">
      <SectionTitle sub="Observe → Detect → Promote → Verify → Skill">Learning Hub</SectionTitle>

      <div className="mt-4 flex items-center gap-2">
        {STAGES.map((s, i) => (
          <React.Fragment key={s.key}>
            <Card className="flex-1 px-3 py-2 text-center">
              <Badge tone={s.tone}>{s.label}</Badge>
              <div className="mt-1 font-mono text-[14px] font-extrabold text-[var(--ink)]">
                {s.key === 'candidate' ? candidates.length : s.key === 'observe' ? '\u25CF' : '\u2014'}
              </div>
            </Card>
            {i < STAGES.length - 1 && <span className="text-[var(--faint)]">\u2192</span>}
          </React.Fragment>
        ))}
      </div>

      <Card className="mt-4 flex items-center gap-3 border-[color-mix(in_oklab,var(--amber)35%,transparent)] bg-[color-mix(in_oklab,var(--amber)4%,var(--card))] p-3">
        <span className="font-mono text-[11px] font-bold text-[var(--ink)]">Workflow Observer</span>
        <span className="font-mono text-[10px] text-[var(--dim)]">PII filtered · opt-out</span>
        <button onClick={toggleObserver} className="ml-auto relative h-4 w-7 rounded-full" style={{ background: observer ? 'var(--olive)' : 'var(--line2)' }}>
          <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white" style={{ left: observer ? 14 : 2 }} />
        </button>
      </Card>

      <Card className="mt-3 p-3">
        <div className="font-mono text-[10.5px] text-[var(--dim)]">
          {'\uD83D\uDEE1'} Anti-38: promoted skills start <strong className="text-[var(--ink)]">unverified</strong> and must pass replay + cross-validation before becoming default-enabled. Thresholds: min 5 occurrences · 80% success · 24h cooldown.
        </div>
      </Card>

      {note && <div className="mt-2 font-mono text-[10px] text-[var(--olive)]">{note}</div>}

      <div className="mt-4 space-y-3">
        {candidates.length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
            No candidate patterns yet. Keep working — the observer surfaces recurring workflows.
          </Card>
        ) : candidates.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-[var(--amber)]">\u2726</span>
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{c.patternName}</span>
              <Badge tone="rust">impact {c.impactScore.toFixed(1)}</Badge>
            </div>
            <p className="mt-1 text-[12px] text-[var(--dim)]">{c.patternDescription}</p>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-[var(--dim)]">
              <span>{c.occurrenceCount}\u00D7 observed</span>
              <span>\u00B7</span>
              <span>{Math.round(c.successRate * 100)}% success</span>
              <span>\u00B7</span>
              <span>~{c.estTimeSavedPerWeekMin} min/week saved</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" onClick={() => review(c.id, 'promote')}>Promote</Button>
              <Button variant="outline" size="sm" onClick={() => review(c.id, 'promote_customize')}>Customize</Button>
              <Button variant="ghost" size="sm" onClick={() => review(c.id, 'defer')}>Defer</Button>
              <Button variant="ghost" size="sm" onClick={() => review(c.id, 'reject')}>Reject</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}