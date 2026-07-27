// SPDX-License-Identifier: Apache-2.0

import { eventBus } from '../event-bus';
import { store } from './memory';
import type { LearningCandidate } from './memory';

// ---- READS -----------------------------------------------------------------

export function getCandidates() { return store().candidates; }

export function getObserverConfig() {
  return { enabled: store().observerEnabled, scope: 'project', piiFilter: true };
}

export function setObserverConfig(enabled: boolean) {
  store().observerEnabled = enabled;
  eventBus.emit({ kind: 'runtime.ready', actor: 'system', payload: { op: 'observer', enabled } });
  return true;
}

// ---- WRITES ----------------------------------------------------------------

export function setCandidateStatus(id: string, status: LearningCandidate['status']) {
  const c = store().candidates.find((x) => x.id === id);
  if (!c) return false;
  c.status = status;
  eventBus.emit({ kind: 'learning.candidate', actor: 'you', payload: { id, name: c.name, status } });
  return true;
}
