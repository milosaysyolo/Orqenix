// SPDX-License-Identifier: Apache-2.0

import { store, KB_LABEL } from './memory';
import type { KbKind, Tier } from './memory';

// ---- READS -----------------------------------------------------------------

export function getDashboard() {
  const s = store();
  const matrix: Record<string, Record<string, number>> = { T1: {}, T2: {}, T3: {}, T4: {} };
  for (const e of s.entries) {
    const row = matrix[e.tier];
    if (!row) continue;
    row[e.kb] = (row[e.kb] ?? 0) + 1;
  }
  return {
    projectId: s.projectId,
    totalEntries: s.entries.length,
    sessions: { active: s.sessions.filter((x) => x.state === 'running').length, total: s.sessions.length },
    auditValid: s.audit.every((a) => a.valid),
    learning: s.candidates,
    matrix,
    kbLabel: KB_LABEL,
  };
}

export function getAudit() { return store().audit; }
export function getMeshPeers() { return store().meshPeers; }
export function getObservability() { return store().observability; }
