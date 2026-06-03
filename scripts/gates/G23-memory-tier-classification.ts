import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  MemoryTierStore,
  MEMORY_TIER_MIGRATIONS,
  classifyInitialTier,
  evaluatePromotion,
  canDemote,
  nextTier,
  DEFAULT_POLICY,
  ImmutableMemoryError,
} from "@orqenix/memory-tiers";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

class G23 extends GateRunner {
  readonly id = "G23";
  readonly title = "Memory Tier Classification";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G23.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G23.1", "memory-tiers unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/memory-tiers"),
          stdio: "pipe",
        });
      }),

      await this.check("G23.2", "classifyInitialTier respects observation rule", () => {
        if (classifyInitialTier("observation", 0.95) !== "working") {
          throw new Error("observation must always classify as working");
        }
      }),

      await this.check("G23.3", "classifyInitialTier respects confidence floor", () => {
        if (classifyInitialTier("fact", 0.3) !== "working") {
          throw new Error("confidence < 0.5 must classify as working");
        }
      }),

      await this.check(
        "G23.4",
        "promotion path working -> episodic -> semantic -> procedural",
        () => {
          const base = {
            id: "mem:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as any,
            contentHash: "0".repeat(64),
            sourceEntryIds: ["ce:1"],
            confidence: 0.9,
            createdAt: "2025-01-01T00:00:00Z",
            lastAccessedAt: "2025-01-01T00:00:00Z",
            accessCount: 999,
            scopeId: SCOPE,
            metadata: {},
          };
          const NOW = new Date("2026-06-01T00:00:00Z").getTime();
          const w = evaluatePromotion(
            { ...base, tier: "working", type: "fact", content: "x" },
            NOW,
            DEFAULT_POLICY,
          );
          if (w !== "episodic") throw new Error(`expected episodic, got ${w}`);
          const e = evaluatePromotion(
            { ...base, tier: "episodic", type: "fact", content: "x" },
            NOW,
            DEFAULT_POLICY,
          );
          if (e !== "semantic") throw new Error(`expected semantic, got ${e}`);
          const s = evaluatePromotion(
            { ...base, tier: "semantic", type: "skill", content: "x" },
            NOW,
            DEFAULT_POLICY,
          );
          if (s !== "procedural") throw new Error(`expected procedural, got ${s}`);
          const p = evaluatePromotion(
            { ...base, tier: "procedural", type: "skill", content: "x" },
            NOW,
            DEFAULT_POLICY,
          );
          if (p !== null) throw new Error("procedural must be terminal");
        },
      ),

      await this.check("G23.5", "canDemote + nextTier sanity", () => {
        if (!canDemote("working") || !canDemote("episodic"))
          throw new Error("working/episodic must be demotable");
        if (canDemote("semantic") || canDemote("procedural"))
          throw new Error("semantic/procedural must not be demotable");
        if (nextTier("working") !== "episodic") throw new Error("working -> episodic");
        if (nextTier("procedural") !== null) throw new Error("procedural is terminal");
      }),

      await this.check(
        "G23.6",
        "MemoryTierStore enforces content_hash + scope idempotency (50 inserts -> 1 entry)",
        async () => {
          const dir = await mkdtemp(join(tmpdir(), "g23-6-"));
          try {
            const conn = new SqliteConnection({ path: join(dir, "g.sqlite") });
            runMigrations(conn, MEMORY_TIER_MIGRATIONS);
            const store = new MemoryTierStore({ conn, scopeId: SCOPE });
            for (let i = 0; i < 50; i++) {
              store.insert({
                tier: "working",
                type: "fact",
                content: "same content",
                sourceEntryIds: [`ce:${i}`],
                confidence: 0.8,
                scopeId: SCOPE,
                metadata: {},
              });
            }
            const counts = store.countByTier();
            const total = counts.working + counts.episodic + counts.semantic + counts.procedural;
            if (total !== 1) throw new Error(`expected 1 dedup-ed entry, got ${total}`);
            conn.close();
          } finally {
            await rm(dir, { recursive: true, force: true });
          }
        },
      ),

      await this.check("G23.7", "promote into procedural makes entry immutable", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g23-7-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "g.sqlite") });
          runMigrations(conn, MEMORY_TIER_MIGRATIONS);
          const store = new MemoryTierStore({ conn, scopeId: SCOPE });
          const e = store.insert({
            tier: "semantic",
            type: "skill",
            content: "how to ship Phase 5",
            sourceEntryIds: ["ce:1"],
            confidence: 0.9,
            scopeId: SCOPE,
            metadata: {},
          });
          store.promote(e.id, "procedural");
          let caught = false;
          try {
            store.promote(e.id, "semantic");
          } catch (err) {
            caught = err instanceof ImmutableMemoryError;
          }
          if (!caught) throw new Error("procedural was not immutable");
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G23-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G23();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G23 crashed:", e);
  process.exit(2);
});
