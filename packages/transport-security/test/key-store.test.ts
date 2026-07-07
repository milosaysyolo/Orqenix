import { describe, it, expect } from "vitest";
import { LRUKeyStore } from "../src/key-store.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

const PK = () => new Uint8Array(32).fill(7);

describe("LRUKeyStore", () => {
  it("put + get is a hit", async () => {
    const s = new LRUKeyStore({ maxEntries: 4 });
    s.put("scp_b3_a" as ScopeId, PK());
    const got = await s.get("scp_b3_a" as ScopeId);
    expect(got?.length).toBe(32);
    expect(s.getStats().hits).toBe(1);
  });

  it("miss with no resolver returns undefined", async () => {
    const s = new LRUKeyStore();
    expect(await s.get("scp_b3_unknown" as ScopeId)).toBeUndefined();
    expect(s.getStats().misses).toBe(1);
  });

  it("LRU eviction beyond maxEntries", async () => {
    const s = new LRUKeyStore({ maxEntries: 2 });
    s.put("a" as ScopeId, PK());
    s.put("b" as ScopeId, PK());
    s.put("c" as ScopeId, PK());
    expect(await s.get("a" as ScopeId)).toBeUndefined();
    expect(await s.get("c" as ScopeId)).toBeDefined();
  });

  it("resolver fills the cache on miss", async () => {
    const s = new LRUKeyStore({
      resolver: { resolve: async () => PK() },
    });
    const got = await s.get("scp_b3_a" as ScopeId);
    expect(got?.length).toBe(32);
    const again = await s.get("scp_b3_a" as ScopeId);
    expect(again?.length).toBe(32);
    const stats = s.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it("rejects non-32-byte keys", () => {
    const s = new LRUKeyStore();
    expect(() => s.put("a" as ScopeId, new Uint8Array(16))).toThrow();
  });
});
