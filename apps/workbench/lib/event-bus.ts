// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// EVENT BUS — server-side in-memory pub/sub with a ring buffer.
// Upgraded from the original with correlation IDs (parent/child event chains)
// and richer event kinds so the UI can correlate events into flows.
// ============================================================================

export type OrqenixEventKind =
  | 'runtime.ready'
  | 'memory.write'
  | 'query.stage'
  | 'session.started'
  | 'session.updated'
  | 'session.ended'
  | 'subagent.spawned'
  | 'subagent.returned'
  | 'agent.message'
  | 'agent.status'
  | 'learning.candidate'
  | 'audit.appended'
  | 'log';

export interface OrqenixEvent {
  id: string;
  kind: OrqenixEventKind;
  ts: string;
  /** Groups events that belong to one logical flow (e.g. a query or a session). */
  correlationId?: string;
  /** Optional parent event id — forms parent/child chains. */
  parentId?: string;
  /** Optional actor this event concerns (agent name, session id, etc.). */
  actor?: string;
  payload: Record<string, unknown>;
}

type Listener = (e: OrqenixEvent) => void;

let seq = 0;
function newId(): string {
  seq = (seq + 1) % 1_000_000;
  return `evt_${Date.now().toString(36)}_${seq.toString(36)}`;
}

class EventBus {
  private listeners = new Set<Listener>();
  private readonly ring: OrqenixEvent[] = [];
  private readonly ringMax = 200;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: Omit<OrqenixEvent, 'id' | 'ts'> & { ts?: string }): OrqenixEvent {
    const full: OrqenixEvent = { ...e, id: newId(), ts: e.ts ?? new Date().toISOString() };
    // Trim before push so ring buffer never exceeds cap.
    if (this.ring.length >= this.ringMax) this.ring.shift();
    this.ring.push(full);
    // Snapshot listeners to avoid iteration hazards if a listener subscribes/unsubscribes re-entrantly.
    for (const fn of [...this.listeners]) {
      try {
        fn(full);
      } catch (err) {
        console.warn('[EventBus] listener error:', err);
      }
    }
    return full;
  }

  recent(limit = 50): OrqenixEvent[] {
    return this.ring.slice(-limit);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __orqenixBus: EventBus | undefined;
}
export const eventBus: EventBus = globalThis.__orqenixBus ?? (globalThis.__orqenixBus = new EventBus());
