// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Candidate {
  id: string; patternName: string; patternDescription: string;
  occurrenceCount: number; successRate: number; impactScore: number;
  estTimeSavedPerWeekMin: number; status: string;
}

const STAGES = [
  { key: 'observe', label: 'Observe', tone: 'slate' as const, icon: '\u25CB' },
  { key: 'detect', label: 'Detect', tone: 'amber' as const, icon: '\u2606' },
  { key: 'candidate', label: 'Candidates', tone: 'rust' as const, icon: '\u2726' },
  { key: 'verify', label: 'Verify', tone: 'olive' as const, icon: '\u2713' },
  { key: 'skill', label: 'Skills', tone: 'teal' as const, icon: '\u2699' },
];

export default function LearningPage() {
  const router = useRouter();
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [observerOn, setObserverOn] = React.useState(true);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [candRes, obsRes] = await Promise.all([
      api.get<{ candidates: Candidate[] }>('/api/learning'),
      api.get<{ config: { enabled: boolean } }>('/api/learning/observer'),
    ]);
    if (candRes.ok) setCandidates(candRes.data!.candidates);
    if (obsRes.ok) setObserverOn(obsRes.data!.config.enabled);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function toggleObserver() {
    const res = await api.post('/api/learning/observer', { enabled: !observerOn });
    if (res.ok) setObserverOn(!observerOn);
  }

  async function review(id: string, action: 'promote' | 'promote_customize' | 'reject' | 'defer') {
    const res = await api.post<{ ok: boolean; generatedSkillName?: string; openBuilder?: boolean }>('/api/learning', { action, candidateId: id });
    if (res.ok) {
      if (res.data?.openBuilder) {
        router.push('/marketplace/new?fromCandidate=' + encodeURIComponent(id));
        return;
      }
      setNote(res.data?.generatedSkillName ? `promoted \u2192 ${res.data.generatedSkillName}` : `${action} ok`);
      await load();
    } else setNote(res.error ?? 'failed');
  }

  const pendingCandidates = candidates.filter((c) => c.status === 'pending');
  const acceptedCandidates = candidates.filter((c) => c.status === 'accepted' || c.status === 'approved');
  const totalTimeSaved = candidates.reduce((s, c) => s + c.estTimeSavedPerWeekMin, 0);

  return (
    <div className="mx-auto max-w-[1300px] px-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <SectionTitle sub="Observe \u2192 Detect \u2192 Promote \u2192 Verify \u2192 Skill">Learning Hub</SectionTitle>
        </div>
        <Badge tone="amber">{candidates.length} candidates</Badge>
      </div>

      {/* Pipeline overview */}
      <div className="mt-4 flex items-center gap-2">
        {STAGES.map((s, i) => {
          const stageValue = s.key === 'candidate' ? pendingCandidates.length
            : s.key === 'observe' ? (observerOn ? 1 : 0)
            : s.key === 'skill' ? acceptedCandidates.length
            : '\u2014';
          return (
            <React.Fragment key={s.key}>
              <Card className={`flex-1 px-3 py-2.5 text-center transition-all ${
                s.key === 'candidate' && pendingCandidates.length > 0
                  ? 'border-[var(--rust)]/40 shadow-sm'
                  : ''
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[12px]" style={{ color: `var(--${s.tone})` }}>{s.icon}</span>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <div className="mt-1.5 font-mono text-[16px] font-extrabold text-[var(--ink)]">
                  {stageValue === 1 && s.key === 'observe' ? '\u25CF'
                    : stageValue === 0 && s.key === 'observe' ? '\u25CB'
                    : typeof stageValue === 'number' ? stageValue
                    : stageValue}
                </div>
              </Card>
              {i < STAGES.length - 1 && (
                <span className="font-mono text-[13px] text-[var(--line2)]">{'\u2192'}</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-4 flex gap-4 flex-col lg:flex-row">
        {/* Left column: candidates */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Observer toggle */}
          <Card className="p-3 border-[var(--line)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-[var(--ink)]">Workflow Observer</span>
                {observerOn ? <Badge tone="olive">active</Badge> : <Badge tone="neutral">paused</Badge>}
              </div>
              <button onClick={toggleObserver}
                className={'relative h-5 w-9 rounded-full transition-colors ' + (observerOn ? 'bg-[var(--rust)]' : 'bg-[var(--line2)]')}>
                <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ' + (observerOn ? 'left-[18px]' : 'left-[2px]')} />
              </button>
            </div>
            <p className="mt-1 text-[10.5px] text-[var(--dim)]">
              Captures recurring workflow patterns for skill genesis. PII-filtered.
            </p>
          </Card>

          {note && (
            <div className="rounded-md border border-[var(--olive)]/40 bg-[color-mix(in_oklab,var(--olive)_6%,transparent)] px-3 py-2 font-mono text-[10px] text-[var(--olive)]">
              {note}
            </div>
          )}

          {pendingCandidates.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="font-mono text-[24px] text-[var(--faint)]/40">{'\u2726'}</div>
              <div className="mt-2 font-mono text-[11px] text-[var(--faint)]">
                No candidate patterns yet. Keep working \u2014 the observer surfaces recurring workflows.
              </div>
            </Card>
          ) : pendingCandidates.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--amber)] text-[14px]">{'\u2726'}</span>
                    <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{c.patternName}</span>
                    <Badge tone="rust">impact {c.impactScore.toFixed(1)}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--dim)] line-clamp-2">{c.patternDescription}</p>
                  <div className="mt-2 flex flex-wrap gap-3 font-mono text-[9.5px] text-[var(--faint)]">
                    <span>{c.occurrenceCount}\u00D7 observed</span>
                    <span>{'\u00B7'}</span>
                    <span>{Math.round(c.successRate * 100)}% success</span>
                    <span>{'\u00B7'}</span>
                    <span>~{c.estTimeSavedPerWeekMin} min/week saved</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Button variant="primary" size="sm" onClick={() => review(c.id, 'promote')}>Promote</Button>
                  <Button variant="outline" size="sm" onClick={() => review(c.id, 'promote_customize')}>Customize</Button>
                  <Button variant="ghost" size="sm" onClick={() => review(c.id, 'defer')}>Defer</Button>
                  <Button variant="ghost" size="sm" onClick={() => review(c.id, 'reject')}>Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-[260px] shrink-0 space-y-3">
          {/* Anti-38 notice */}
          <Card className="p-3 border-[var(--amber)]/30 bg-[color-mix(in_oklab,var(--amber)_5%,var(--card))]">
            <div className="font-mono text-[9.5px] text-[var(--dim)] leading-relaxed">
              <strong className="text-[var(--ink)]">Anti-38:</strong> Promoted skills start <strong>unverified</strong> and must pass replay + cross-validation before becoming default-enabled.
            </div>
          </Card>

          {/* Quick stats */}
          <Card className="p-3">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--faint)] mb-2">Stats</div>
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-[var(--faint)]">Pending review</span>
                <span className="font-bold text-[var(--rust)]">{pendingCandidates.length}</span>
              </div>
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-[var(--faint)]">Accepted</span>
                <span className="font-bold text-[var(--olive)]">{acceptedCandidates.length}</span>
              </div>
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-[var(--faint)]">Time saved/week</span>
                <span className="font-bold text-[var(--teal)]">~{totalTimeSaved} min</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--paper2)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--rust)]" style={{ width: `${candidates.length > 0 ? (acceptedCandidates.length / candidates.length) * 100 : 0}%` }} />
              </div>
              <div className="font-mono text-[8.5px] text-[var(--faint)] text-right">{acceptedCandidates.length}/{candidates.length} promoted</div>
            </div>
          </Card>

          {/* Links */}
          <Card className="p-3">
            <div className="space-y-1">
              <button onClick={() => router.push('/learning/candidates')}
                className="w-full rounded-sm px-2 py-1.5 text-left font-mono text-[10px] text-[var(--dim)] hover:bg-[var(--paper2)] transition-colors">
                {'\u2192'} All candidates
              </button>
              <button onClick={() => router.push('/learning/verify')}
                className="w-full rounded-sm px-2 py-1.5 text-left font-mono text-[10px] text-[var(--dim)] hover:bg-[var(--paper2)] transition-colors">
                {'\u2192'} Verify skills
              </button>
              <button onClick={() => router.push('/learning/cross-project')}
                className="w-full rounded-sm px-2 py-1.5 text-left font-mono text-[10px] text-[var(--dim)] hover:bg-[var(--paper2)] transition-colors">
                {'\u2192'} Cross-project sync
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
