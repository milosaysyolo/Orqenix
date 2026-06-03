// SPDX-License-Identifier: Apache-2.0
// @gate G11
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { KeywordRecall } from "@orqenix/prompt-rewriter";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function setup(): Promise<{
  store: MemoryTierStore;
  recall: KeywordRecall;
  conn: SqliteConnection;
  dir: string;
}> {
  const dir = await mkdtemp(join(tmpdir(), "g11-"));
  const conn = new SqliteConnection({ path: join(dir, "r.sqlite") });
  runMigrations(conn, MEMORY_TIER_MIGRATIONS);
  const store = new MemoryTierStore({ conn, scopeId: SCOPE });
  const recall = new KeywordRecall(store, SCOPE);
  return { store, recall, conn, dir };
}

async function teardown(conn: SqliteConnection, dir: string): Promise<void> {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

class G11 extends GateRunner {
  readonly id = "G11";
  readonly title = "Memory Recall";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G11.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G11.1", "recall returns matches for keyword query", async () => {
        const { store, recall, conn, dir } = await setup();
        try {
          store.insert({
            tier: "episodic",
            type: "preference",
            content: "I prefer Rust for runtime",
            sourceEntryIds: ["ce:1"],
            confidence: 0.9,
            scopeId: SCOPE,
            metadata: {},
          });
          const r = recall.recall("rust runtime", { k: 5 });
          if (r.length === 0) throw new Error("expected match");
          if (!r[0].content.includes("Rust")) throw new Error("wrong match");
        } finally {
          await teardown(conn, dir);
        }
      }),

      await this.check("G11.2", "recall respects tier filter", async () => {
        const { store, recall, conn, dir } = await setup();
        try {
          store.insert({
            tier: "working",
            type: "observation",
            content: "noticed rust crate updates",
            sourceEntryIds: ["ce:1"],
            confidence: 0.4,
            scopeId: SCOPE,
            metadata: {},
          });
          store.insert({
            tier: "semantic",
            type: "learning",
            content: "rust has zero-cost abstractions",
            sourceEntryIds: ["ce:2"],
            confidence: 0.95,
            scopeId: SCOPE,
            metadata: {},
          });
          const onlyWorking = recall.recall("rust", { k: 5, tiers: ["working"] });
          const onlySemantic = recall.recall("rust", { k: 5, tiers: ["semantic"] });
          if (onlyWorking.length !== 1 || onlyWorking[0].tier !== "working")
            throw new Error("tier filter failed for working");
          if (onlySemantic.length !== 1 || onlySemantic[0].tier !== "semantic")
            throw new Error("tier filter failed for semantic");
        } finally {
          await teardown(conn, dir);
        }
      }),

      await this.check(
        "G11.3",
        "higher confidence ranks higher for same keyword count",
        async () => {
          const { store, recall, conn, dir } = await setup();
          try {
            store.insert({
              tier: "working",
              type: "fact",
              content: "rust is good",
              sourceEntryIds: ["ce:1"],
              confidence: 0.4,
              scopeId: SCOPE,
              metadata: {},
            });
            store.insert({
              tier: "working",
              type: "fact",
              content: "rust is great",
              sourceEntryIds: ["ce:2"],
              confidence: 0.95,
              scopeId: SCOPE,
              metadata: {},
            });
            const r = recall.recall("rust", { k: 2 });
            if (r[0].confidence !== 0.95) throw new Error("higher confidence should rank first");
          } finally {
            await teardown(conn, dir);
          }
        },
      ),

      await this.check("G11.4", "recall increments accessCount on returned memories", async () => {
        const { store, recall, conn, dir } = await setup();
        try {
          const e = store.insert({
            tier: "working",
            type: "fact",
            content: "rust is fast",
            sourceEntryIds: ["ce:1"],
            confidence: 0.8,
            scopeId: SCOPE,
            metadata: {},
          });
          const before = store.getById(e.id).accessCount;
          recall.recall("rust", { k: 5 });
          const after = store.getById(e.id).accessCount;
          if (after <= before)
            throw new Error(`accessCount not incremented: ${before} -> ${after}`);
        } finally {
          await teardown(conn, dir);
        }
      }),

      await this.check("G11.5", "empty query returns empty result", async () => {
        const { recall, conn, dir } = await setup();
        try {
          if (recall.recall("", { k: 5 }).length !== 0)
            throw new Error("empty query should return empty");
          if (recall.recall("a", { k: 5 }).length !== 0)
            throw new Error("too-short tokens should be ignored");
        } finally {
          await teardown(conn, dir);
        }
      }),

      await this.check("G11.6", "recall returns at most k", async () => {
        const { store, recall, conn, dir } = await setup();
        try {
          for (let i = 0; i < 20; i++) {
            store.insert({
              tier: "working",
              type: "fact",
              content: `rust thing ${i}`,
              sourceEntryIds: [`ce:${i}`],
              confidence: 0.8,
              scopeId: SCOPE,
              metadata: {},
            });
          }
          const r = recall.recall("rust", { k: 7 });
          if (r.length > 7) throw new Error(`k cap not honored, got ${r.length}`);
        } finally {
          await teardown(conn, dir);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G11-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G11();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G11 crashed:", e);
  process.exit(2);
});
