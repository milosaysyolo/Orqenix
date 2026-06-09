import type { MeshResponse } from '@orqenix/mesh-transport-core';

interface Entry {
  resp: MeshResponse;
  expiresAt: number;
}

export interface CrossTransportDedupOptions {
  maxEntries?: number;
  now?: () => number;
}

export class CrossTransportDedup {
  private readonly map = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: CrossTransportDedupOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 4_096;
    this.now = opts.now ?? Date.now;
  }

  get(id: string): MeshResponse | undefined {
    const e = this.map.get(id);
    if (!e) return undefined;
    if (this.now() >= e.expiresAt) {
      this.map.delete(id);
      return undefined;
    }
    this.map.delete(id);
    this.map.set(id, e);
    return e.resp;
  }

  set(id: string, resp: MeshResponse, ttlMs: number): void {
    if (this.map.has(id)) this.map.delete(id);
    this.map.set(id, { resp, expiresAt: this.now() + Math.max(0, ttlMs) });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  size(): number {
    return this.map.size;
  }

  hasUnexpired(id: string): boolean {
    const e = this.map.get(id);
    return !!(e && this.now() < e.expiresAt);
  }
}
