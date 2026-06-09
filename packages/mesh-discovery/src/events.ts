// packages/mesh-discovery/src/events.ts
import type { ScopeId } from '@orqenix/mesh-transport-core';

export type DiscoveryState =
  | 'Discovered'
  | 'Connecting'
  | 'Connected'
  | 'Stale'
  | 'Lost';

export interface DiscoveryEvent {
  scopeId: ScopeId;
  peerId?: string;
  multiaddrs: string[];
  state: DiscoveryState;
  at: number;
}

const ALLOWED: Record<DiscoveryState, ReadonlyArray<DiscoveryState>> = {
  Discovered: ['Connecting', 'Lost'],
  Connecting: ['Connected', 'Lost'],
  Connected: ['Stale', 'Lost'],
  Stale: ['Connected', 'Lost'],
  Lost: ['Discovered'],
};

interface Entry {
  state: DiscoveryState;
  peerId?: string;
  multiaddrs: string[];
  at: number;
}

export type Listener = (evt: DiscoveryEvent) => void;

export class DiscoveryStateMachine {
  private byScope = new Map<ScopeId, Entry>();
  private listeners = new Set<Listener>();

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  discover(scopeId: ScopeId, multiaddrs: string[], peerId?: string): void {
    const existing = this.byScope.get(scopeId);
    if (!existing) {
      const entry: Entry = { state: 'Discovered', peerId, multiaddrs, at: Date.now() };
      this.byScope.set(scopeId, entry);
      this.emit(scopeId, entry);
      return;
    }
    if (existing.state === 'Lost') {
      this.transition(scopeId, 'Discovered', { peerId, multiaddrs });
    } else {
      existing.multiaddrs = multiaddrs;
      if (peerId) existing.peerId = peerId;
    }
  }

  transition(scopeId: ScopeId, next: DiscoveryState, update?: { peerId?: string; multiaddrs?: string[] }): void {
    const entry = this.byScope.get(scopeId);
    if (!entry) throw new Error(`discovery: no entry for ${scopeId}`);
    const allowed = ALLOWED[entry.state];
    if (!allowed.includes(next)) {
      throw new Error(`discovery: illegal transition ${entry.state} -> ${next}`);
    }
    entry.state = next;
    if (update?.peerId) entry.peerId = update.peerId;
    if (update?.multiaddrs) entry.multiaddrs = update.multiaddrs;
    entry.at = Date.now();
    this.emit(scopeId, entry);
  }

  state(scopeId: ScopeId): DiscoveryState | undefined {
    return this.byScope.get(scopeId)?.state;
  }

  snapshot(): DiscoveryEvent[] {
    return [...this.byScope.entries()].map(([scopeId, e]) => ({
      scopeId,
      peerId: e.peerId,
      multiaddrs: e.multiaddrs,
      state: e.state,
      at: e.at,
    }));
  }

  private emit(scopeId: ScopeId, e: Entry): void {
    const evt: DiscoveryEvent = {
      scopeId,
      peerId: e.peerId,
      multiaddrs: e.multiaddrs,
      state: e.state,
      at: e.at,
    };
    for (const l of this.listeners) {
      try { l(evt); } catch { /* listeners must not throw; swallow */ }
    }
  }
}
