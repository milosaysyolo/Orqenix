// packages/mesh-discovery/src/discovery.ts
import type { ScopeId } from '@orqenix/mesh-transport-core';
import {
  DiscoveryStateMachine,
  type DiscoveryEvent,
  type Listener,
} from './events.js';
import { nextReconnectDelay, type BootstrapConfig } from './bootstrap.js';

export interface MeshDiscoveryOptions {
  bootstrap?: BootstrapConfig;
  now?: () => number;
}

interface BootstrapAttempt {
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
}

export class MeshDiscovery {
  private sm = new DiscoveryStateMachine();
  private bootstrap?: BootstrapConfig;
  private bootstrapAttempts = new Map<string, BootstrapAttempt>();
  private stopped = false;

  constructor(opts: MeshDiscoveryOptions = {}) {
    this.bootstrap = opts.bootstrap;
  }

  on(listener: Listener): () => void {
    return this.sm.on(listener);
  }

  state(scopeId: ScopeId) {
    return this.sm.state(scopeId);
  }

  snapshot(): DiscoveryEvent[] {
    return this.sm.snapshot();
  }

  onMdnsPeerFound(scopeId: ScopeId, multiaddrs: string[], peerId?: string): void {
    if (this.stopped) return;
    this.sm.discover(scopeId, multiaddrs, peerId);
  }

  onMdnsPeerLost(scopeId: ScopeId): void {
    if (this.stopped) return;
    const state = this.sm.state(scopeId);
    if (state && state !== 'Lost') {
      this.sm.transition(scopeId, 'Lost');
    }
  }

  markConnecting(scopeId: ScopeId): void {
    if (this.stopped) return;
    if (this.sm.state(scopeId) === 'Discovered' || this.sm.state(scopeId) === 'Stale') {
      this.sm.transition(scopeId, 'Connecting');
    }
  }
  markConnected(scopeId: ScopeId): void {
    if (this.stopped) return;
    const s = this.sm.state(scopeId);
    if (s === 'Connecting' || s === 'Stale') {
      this.sm.transition(scopeId, 'Connected');
    }
  }
  markStale(scopeId: ScopeId): void {
    if (this.stopped) return;
    if (this.sm.state(scopeId) === 'Connected') {
      this.sm.transition(scopeId, 'Stale');
    }
  }
  markLost(scopeId: ScopeId): void {
    if (this.stopped) return;
    const s = this.sm.state(scopeId);
    if (s && s !== 'Lost') this.sm.transition(scopeId, 'Lost');
  }

  scheduleBootstrapAttempt(
    multiaddr: string,
    attemptFn: () => Promise<boolean>,
    rand: () => number = Math.random,
  ): void {
    if (this.stopped) return;
    if (!this.bootstrap) return;

    const policy = this.bootstrap.reconnect;
    const slot = this.bootstrapAttempts.get(multiaddr) ?? { attempts: 0 };
    this.bootstrapAttempts.set(multiaddr, slot);

    const delay = nextReconnectDelay(policy, slot.attempts, rand);
    slot.timer = setTimeout(async () => {
      slot.timer = undefined;
      let ok = false;
      try { ok = await attemptFn(); } catch { ok = false; }
      if (ok) {
        slot.attempts = 0;
      } else {
        slot.attempts++;
        if (!this.stopped) this.scheduleBootstrapAttempt(multiaddr, attemptFn, rand);
      }
    }, delay);
    if (typeof (slot.timer as { unref?: () => void }).unref === 'function') {
      (slot.timer as unknown as { unref: () => void }).unref();
    }
  }

  stop(): void {
    this.stopped = true;
    for (const slot of this.bootstrapAttempts.values()) {
      if (slot.timer) clearTimeout(slot.timer);
    }
    this.bootstrapAttempts.clear();
  }

  pendingBootstrap(): number {
    let n = 0;
    for (const s of this.bootstrapAttempts.values()) if (s.timer) n++;
    return n;
  }
}
