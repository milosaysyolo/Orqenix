import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ChatStore, CHAT_KB_MIGRATIONS } from "@orqenix/kb-chat";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { HeuristicDistiller } from "../src";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("HeuristicDistiller", () => {
  let dir: string;
  let conn: SqliteConnection;
  let chat: ChatStore;
  let memStore: MemoryTierStore;
  let distiller: HeuristicDistiller;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-d-"));
    conn = new SqliteConnection({ path: join(dir, "d.sqlite") });
    runMigrations(conn, CHAT_KB_MIGRATIONS);
    runMigrations(conn, MEMORY_TIER_MIGRATIONS);
    chat = new ChatStore({ conn, scopeId: SCOPE });
    memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
    distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: SCOPE });
  });
  afterEach(async () => {
    conn.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("distills preferences from user content", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    await chat.appendEntry({
      sessionId: s.sessionId,
      role: "user",
      content: "I prefer Rust for runtime work",
      metadata: {},
    });
    const stats = distiller.distillBatch();
    expect(stats.entriesScanned).toBe(1);
    expect(stats.memoriesCreated).toBeGreaterThanOrEqual(1);
    const prefs = memStore.listByType("preference");
    expect(prefs.length).toBeGreaterThanOrEqual(1);
  });

  it("is idempotent across reruns (watermark advances)", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    await chat.appendEntry({
      sessionId: s.sessionId,
      role: "user",
      content: "I prefer SQLite for OSS",
      metadata: {},
    });
    const first = distiller.distillBatch();
    expect(first.entriesScanned).toBe(1);
    const second = distiller.distillBatch();
    expect(second.entriesScanned).toBe(0);
  });

  it("skips system role entries", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    await chat.appendEntry({
      sessionId: s.sessionId,
      role: "system",
      content: "I prefer Rust",
      metadata: {},
    });
    const stats = distiller.distillBatch();
    expect(stats.entriesScanned).toBe(0);
  });

  it("dedupes identical content across entries (content_hash idempotency)", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    await chat.appendEntry({
      sessionId: s.sessionId,
      role: "user",
      content: "I prefer Rust",
      metadata: {},
    });
    distiller.distillBatch();
    await chat.appendEntry({
      sessionId: s.sessionId,
      role: "user",
      content: "I prefer Rust",
      metadata: {},
    });
    const stats = distiller.distillBatch();
    expect(stats.duplicatesSkipped).toBeGreaterThanOrEqual(1);
  });

  it("distillAll processes everything to idle", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    for (let i = 0; i < 5; i++) {
      await chat.appendEntry({
        sessionId: s.sessionId,
        role: "user",
        content: `I decided to use lib-${i}`,
        metadata: {},
      });
    }
    const runs = distiller.distillAll(10);
    const totalScanned = runs.reduce((a, r) => a + r.entriesScanned, 0);
    expect(totalScanned).toBe(5);
    expect(memStore.listByType("decision").length).toBeGreaterThanOrEqual(5);
  });
});
