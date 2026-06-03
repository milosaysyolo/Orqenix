import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ChatStore, CHAT_KB_MIGRATIONS } from "@orqenix/kb-chat";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { HeuristicDistiller, DistillerWorker } from "../src";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("DistillerWorker", () => {
  let dir: string;
  let conn: SqliteConnection;
  let chat: ChatStore;
  let memStore: MemoryTierStore;
  let distiller: HeuristicDistiller;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-w-"));
    conn = new SqliteConnection({ path: join(dir, "w.sqlite") });
    runMigrations(conn, CHAT_KB_MIGRATIONS);
    runMigrations(conn, MEMORY_TIER_MIGRATIONS);
    chat = new ChatStore({ conn, scopeId: SCOPE });
    memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
    distiller = new HeuristicDistiller({
      memStore,
      chatConn: conn,
      scopeId: SCOPE,
      config: { batchSize: 2 },
    });
  });
  afterEach(async () => {
    conn.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("processes all entries then stops on idle", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    for (let i = 0; i < 6; i++) {
      await chat.appendEntry({
        sessionId: s.sessionId,
        role: "user",
        content: `I prefer pattern-${i}`,
        metadata: {},
      });
    }
    const worker = new DistillerWorker({ distiller, idleSleepMs: 5, idleStopRuns: 2 });
    const batches: unknown[] = [];
    worker.on("batch", (s) => batches.push(s));
    await worker.start();
    expect(worker.status).toBe("stopped");
    expect(batches.length).toBeGreaterThanOrEqual(3);
    expect(memStore.listByType("preference").length).toBeGreaterThanOrEqual(6);
  });

  it("stop() halts the loop", async () => {
    const s = chat.createSession({ scopeId: SCOPE, title: "t" });
    for (let i = 0; i < 50; i++) {
      await chat.appendEntry({
        sessionId: s.sessionId,
        role: "user",
        content: `I prefer x-${i}`,
        metadata: {},
      });
    }
    const worker = new DistillerWorker({ distiller, idleSleepMs: 5 });
    const p = worker.start();
    setTimeout(() => worker.stop(), 20);
    await p;
    expect(worker.status).toBe("stopped");
  });

  it("emits error event on internal failure", async () => {
    conn.exec("DROP TABLE memory_distiller_watermarks");
    const worker = new DistillerWorker({ distiller, idleSleepMs: 5, idleStopRuns: 1 });
    const errors: unknown[] = [];
    worker.on("error", (e) => errors.push(e));
    await worker.start();
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});
