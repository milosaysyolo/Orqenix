// SPDX-License-Identifier: Apache-2.0

export type OrqenixEventKind =
  | 'runtime.ready'
  | 'memory.write'
  | 'query.stage'
  | 'session.started'
  | 'session.updated'
  | 'subagent.spawned'
  | 'subagent.returned'
  | 'agent.message'
  | 'learning.candidate'
  | 'audit.appended'
  | 'log';

export interface OrqenixEvent {
  kind: OrqenixEventKind;
  ts: string;
  payload: Record<string, unknown>;
}

type Listener = (e: OrqenixEvent) => void;

class EventBus {
  private listeners = new Set<Listener>();
  private readonly ring: OrqenixEvent[] = [];
  private readonly ringMax = 200;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: OrqenixEvent): void {
    this.ring.push(e);
    if (this.ring.length > this.ringMax) this.ring.shift();
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* a bad listener must not break the bus */
      }
    }
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
