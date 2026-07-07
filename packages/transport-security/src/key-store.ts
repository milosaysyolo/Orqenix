import type { ScopeId } from "@orqenix/mesh-transport-core";

export interface KeyResolver {
  resolve(scopeId: ScopeId): Promise<Uint8Array | undefined>;
}

export interface KeyStoreOptions {
  maxEntries?: number;
  resolver?: KeyResolver;
}

export interface KeyStoreStats {
  hits: number;
  misses: number;
  size: number;
}

export class LRUKeyStore {
  private readonly maxEntries: number;
  private readonly resolver?: KeyResolver;
  private readonly map = new Map<ScopeId, Uint8Array>();
  private hits = 0;
  private misses = 0;

  constructor(opts: KeyStoreOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 4_096;
    this.resolver = opts.resolver;
  }

  put(scopeId: ScopeId, publicKey: Uint8Array): void {
    if (publicKey.length !== 32) throw new Error("LRUKeyStore: public key must be 32 bytes");
    if (this.map.has(scopeId)) this.map.delete(scopeId);
    this.map.set(scopeId, publicKey);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async get(scopeId: ScopeId): Promise<Uint8Array | undefined> {
    const cached = this.map.get(scopeId);
    if (cached) {
      this.hits++;
      this.map.delete(scopeId);
      this.map.set(scopeId, cached);
      return cached;
    }
    this.misses++;
    if (!this.resolver) return undefined;
    const fetched = await this.resolver.resolve(scopeId);
    if (fetched) this.put(scopeId, fetched);
    return fetched;
  }

  getStats(): KeyStoreStats {
    return { hits: this.hits, misses: this.misses, size: this.map.size };
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
