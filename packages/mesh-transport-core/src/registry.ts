// packages/mesh-transport-core/src/registry.ts
/**
 * DefaultTransportRegistry implements TransportRegistry.
 * Agent note: this class is the seam for a future Pro-only Rust accelerator
 * (rust-libp2p via NAPI-RS) at Phase 7+. Do not embed transport-specific logic here.
 */
import type { MeshTransport, ScopeId, TransportRegistry } from './types.js';

interface Entry {
  transport: MeshTransport;
  order: number;
}

export class DefaultTransportRegistry implements TransportRegistry {
  private entries = new Map<string, Entry>();
  private counter = 0;

  register(t: MeshTransport): void {
    if (this.entries.has(t.kind)) {
      throw new Error(`transport already registered: ${t.kind}`);
    }
    this.entries.set(t.kind, { transport: t, order: this.counter++ });
  }

  unregister(kind: string): void {
    this.entries.delete(kind);
  }

  get(kind: string): MeshTransport | undefined {
    return this.entries.get(kind)?.transport;
  }

  all(): MeshTransport[] {
    return [...this.entries.values()]
      .sort((a, b) => a.order - b.order)
      .map((e) => e.transport);
  }

  /**
   * Return transports that can currently reach `scopeId`.
   * Phase 6 Part 1 returns all registered transports; richer reachability
   * (peer membership, circuit breaker filtering) lands with Parts 5 and 9.
   * Ordering is deterministic: by transport kind ascending, then registration order.
   */
  reachable(_scopeId: ScopeId): MeshTransport[] {
    return [...this.entries.values()]
      .sort((a, b) => {
        const byKind = a.transport.kind.localeCompare(b.transport.kind);
        if (byKind !== 0) return byKind;
        return a.order - b.order;
      })
      .map((e) => e.transport);
  }
}
