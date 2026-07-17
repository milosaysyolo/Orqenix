// SPDX-License-Identifier: Apache-2.0
// Self-learning subsystem: observer config, instinct candidates, skill genesis, verification

import type { ReviewDecision, PromoterCandidate } from '@orqenix/instinct-promoter';
import type { ObserverConfig } from '@orqenix/self-learning-observer';
import { PROJECT_ID } from '../stores/session-store';
import { getDb, getPromoterSync, getSkillGenesisSync } from '../engine-init';

export interface LearningCandidateResult {
  id: string;
  patternName: string;
  patternDescription: string;
  occurrenceCount: number;
  successRate: number;
  impactScore: number;
  estTimeSavedPerWeekMin: number;
  status: string;
}

function enrichCandidate(c: PromoterCandidate): LearningCandidateResult {
  return {
    id: c.id,
    patternName: c.patternName,
    patternDescription: c.patternDescription,
    occurrenceCount: c.occurrenceCount,
    successRate: c.successRate,
    impactScore: c.impactScore,
    estTimeSavedPerWeekMin: c.estTimeSavedPerWeekMin,
    status: c.status,
  };
}

export async function getLearningCandidates(): Promise<LearningCandidateResult[]> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const candidates = await promoter.listForReview(PROJECT_ID);
      return candidates.map(enrichCandidate);
    } catch {
      // fall through
    }
  }
  const { getCandidates } = await import('@/lib/demo-store');
  return getCandidates().map((c) => ({
    id: c.id,
    patternName: c.name,
    patternDescription: `Pattern "${c.name}" observed ${c.count} times with ${Math.round(c.successRate * 100)}% success rate.`,
    occurrenceCount: c.count,
    successRate: c.successRate,
    impactScore: c.impact,
    estTimeSavedPerWeekMin: Math.round(c.impact * 30),
    status: c.status,
  }));
}

export async function reviewCandidate(
  candidateId: string, action: string
): Promise<{ ok: boolean; generatedSkillName?: string; openBuilder?: boolean }> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const decision: ReviewDecision = {
        candidateId,
        action: action as ReviewDecision['action'],
        reviewedBy: 'workbench-user',
      };
      const result = await promoter.review(decision, PROJECT_ID);
      return {
        ok: result.ok,
        generatedSkillName: result.generatedSkillName,
        openBuilder: result.openBuilder,
      };
    } catch {
      // fall through
    }
  }
  const { setCandidateStatus } = await import('@/lib/demo-store');
  const status = action === 'promote' || action === 'promote_customize' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
  const ok = setCandidateStatus(candidateId, status);
  if (!ok) return { ok: false };
  const result: { ok: boolean; generatedSkillName?: string; openBuilder?: boolean } = { ok: true };
  if (action === 'promote' || action === 'promote_customize') {
    result.generatedSkillName = `${candidateId}-skill`;
    if (action === 'promote_customize') result.openBuilder = true;
  }
  return result;
}

export async function getObserverConfigData(): Promise<ObserverConfig> {
  const db = getDb();
  if (!db) {
    const { getObserverConfig } = await import('@/lib/demo-store');
    const cfg = getObserverConfig();
    return { enabled: cfg.enabled, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
  }
  const row = db
    .prepare(`SELECT enabled, pii_filter_enabled, notify_on_first_launch, sample_rate FROM workbench_observer_config WHERE id=1`)
    .get() as { enabled?: number; pii_filter_enabled?: number; notify_on_first_launch?: number; sample_rate?: number } | undefined;
  if (!row) return { enabled: true, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
  return {
    enabled: !!row.enabled,
    piiFilterEnabled: !!row.pii_filter_enabled,
    notifyOnFirstLaunch: !!row.notify_on_first_launch,
    sampleRate: row.sample_rate ?? 1.0,
  };
}

export async function setObserverConfigData(config: Partial<ObserverConfig>): Promise<void> {
  const db = getDb();
  if (!db) {
    const { setObserverConfig } = await import('@/lib/demo-store');
    setObserverConfig(config.enabled ?? true);
    return;
  }
  db.prepare(
    `INSERT INTO workbench_observer_config (id, enabled, pii_filter_enabled, notify_on_first_launch, sample_rate)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled=excluded.enabled, pii_filter_enabled=excluded.pii_filter_enabled,
       notify_on_first_launch=excluded.notify_on_first_launch, sample_rate=excluded.sample_rate`,
  ).run(config.enabled ? 1 : 0, config.piiFilterEnabled ? 1 : 0, config.notifyOnFirstLaunch ? 1 : 0, config.sampleRate ?? 1.0);
}

export async function getVerificationCandidates(): Promise<LearningCandidateResult[]> {
  const candidates = await getLearningCandidates();
  return candidates.filter((c) => c.status === 'approved' || c.status === 'promoted');
}

export async function generateSkillFromCandidate(
  candidateId: string, _language?: string, _nameOverride?: string
): Promise<{ ok: boolean; skillName?: string; verificationStatus: string }> {
  const genesis = getSkillGenesisSync();
  if (genesis) {
    try {
      const result = await genesis.generateFromCandidate({
        candidateId,
        projectId: PROJECT_ID,
      });
      return { ok: true, skillName: result.skillName, verificationStatus: 'unverified' };
    } catch {
      // fall through
    }
  }
  return { ok: true, verificationStatus: 'unverified' };
}
