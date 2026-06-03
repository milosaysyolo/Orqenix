import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS, ImmutableMemoryError } from "../src";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("MemoryTierStore", () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: MemoryTierStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-mt-"));
    conn = new SqliteConnection({ path: join(dir, "mt.sqlite") });
    runMigrations(conn, MEMORY_TIER_MIGRATIONS);
    store = new MemoryTierStore({ conn, scopeId: SCOPE });
  });
  afterEach(async () => {
    conn.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("inserts and retrieves by id", () => {
    const e = store.insert({
      tier: "working",
      type: "fact",
      content: "A",
      sourceEntryIds: ["ce:1"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    expect(e.id).toMatch(/^mem:[A-Z2-7]{32}$/);
    expect(store.getById(e.id).content).toBe("A");
  });

  it("insert is idempotent by content_hash + scope_id", () => {
    const a = store.insert({
      tier: "working",
      type: "fact",
      content: "dup",
      sourceEntryIds: ["ce:1"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    const b = store.insert({
      tier: "working",
      type: "fact",
      content: "dup",
      sourceEntryIds: ["ce:2"],
      confidence: 0.9,
      scopeId: SCOPE,
      metadata: {},
    });
    expect(b.id).toBe(a.id);
    expect(store.countByTier().working).toBe(1);
  });

  it("listByTier returns insertion order", () => {
    store.insert({
      tier: "working",
      type: "fact",
      content: "a",
      sourceEntryIds: ["ce:1"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    store.insert({
      tier: "working",
      type: "fact",
      content: "b",
      sourceEntryIds: ["ce:2"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    store.insert({
      tier: "working",
      type: "fact",
      content: "c",
      sourceEntryIds: ["ce:3"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    expect(store.listByTier("working").map((e) => e.content)).toEqual(["a", "b", "c"]);
  });

  it("recordAccess increments counter", () => {
    const e = store.insert({
      tier: "working",
      type: "fact",
      content: "x",
      sourceEntryIds: ["ce:1"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    store.recordAccess(e.id);
    store.recordAccess(e.id);
    expect(store.getById(e.id).accessCount).toBe(2);
  });

  it("promote refuses procedural tier", () => {
    const e = store.insert({
      tier: "semantic",
      type: "skill",
      content: "q",
      sourceEntryIds: ["ce:1"],
      confidence: 0.9,
      scopeId: SCOPE,
      metadata: {},
    });
    store.promote(e.id, "procedural");
    expect(() => store.promote(e.id, "semantic")).toThrow(ImmutableMemoryError);
  });

  it("countByTier returns full breakdown", () => {
    store.insert({
      tier: "working",
      type: "fact",
      content: "a",
      sourceEntryIds: ["ce:1"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    store.insert({
      tier: "episodic",
      type: "fact",
      content: "b",
      sourceEntryIds: ["ce:2"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    store.insert({
      tier: "episodic",
      type: "fact",
      content: "c",
      sourceEntryIds: ["ce:3"],
      confidence: 0.8,
      scopeId: SCOPE,
      metadata: {},
    });
    expect(store.countByTier()).toEqual({ working: 1, episodic: 2, semantic: 0, procedural: 0 });
  });
});
