import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { multiaddr } from "@multiformats/multiaddr";
import type { MeshAddress, ScopeId } from "@orqenix/mesh-transport-core";

export interface PeerEntry {
  http?: string;
  libp2p?: string;
}

export class AddressBook {
  private byScope = new Map<ScopeId, PeerEntry>();

  set(scopeId: ScopeId, entry: PeerEntry): void {
    const existing = this.byScope.get(scopeId) ?? {};
    this.byScope.set(scopeId, { ...existing, ...entry });
  }

  delete(scopeId: ScopeId): void {
    this.byScope.delete(scopeId);
  }

  resolve(kind: string, scopeId: ScopeId): MeshAddress | undefined {
    const e = this.byScope.get(scopeId);
    if (!e) return undefined;
    if (kind === "http" && e.http) return { kind: "http", baseUrl: e.http };
    if (kind === "libp2p" && e.libp2p) return { kind: "libp2p", multiaddr: e.libp2p };
    return undefined;
  }

  size(): number {
    return this.byScope.size;
  }

  snapshot(): Array<{ scopeId: ScopeId; entry: PeerEntry }> {
    return [...this.byScope.entries()].map(([scopeId, entry]) => ({ scopeId, entry }));
  }
}

export async function loadPeersYaml(path: string): Promise<AddressBook> {
  const book = new AddressBook();
  const text = await readFile(path, "utf8");
  const raw = parseYaml(text) as unknown;
  if (!raw || typeof raw !== "object") throw new Error("peers.yaml: not an object");
  const peers = (raw as Record<string, unknown>).peers;
  if (!Array.isArray(peers)) throw new Error('peers.yaml: "peers" must be an array');

  for (const p of peers) {
    if (!p || typeof p !== "object") throw new Error("peers.yaml: entry not an object");
    const e = p as Record<string, unknown>;
    if (typeof e.scope !== "string" || e.scope.length === 0) {
      throw new Error("peers.yaml: scope must be non-empty string");
    }
    const entry: PeerEntry = {};
    if (typeof e.http === "string") entry.http = e.http;
    if (typeof e.libp2p === "string") {
      multiaddr(e.libp2p);
      entry.libp2p = e.libp2p;
    }
    book.set(e.scope as ScopeId, entry);
  }
  return book;
}
