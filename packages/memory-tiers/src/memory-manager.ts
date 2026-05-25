import { join } from "node:path";
import { projectOrqenixDir } from "@orqenix/core";
import type {
  CleanupPlan,
  CleanupResult,
  MemoryEntry,
  MemoryQuery,
  RetentionPolicy,
  Tier,
} from "./types.js";
import { parseDuration } from "./duration.js";
import { TierStore } from "./tier-store.js";

export interface MemoryManagerOptions {
  projectRoot: string;
  policy: RetentionPolicy;
}

export class MemoryManager {
  private stores: Record<Tier, TierStore>;
  private policy: RetentionPolicy;
  private opened = false;

  constructor(opts: MemoryManagerOptions) {
    this.policy = opts.policy;
    const baseDir = join(projectOrqenixDir(opts.projectRoot), "memory");
    this.stores = {
      working: new TierStore("working", join(baseDir, "working.db")),
      episodic: new TierStore("episodic", join(baseDir, "episodic.db")),
      semantic: new TierStore("semantic", join(baseDir, "semantic.db")),
      global: new TierStore("global", join(baseDir, "global.db")),
    };
  }

  async open(): Promise<void> {
    if (this.opened) return;
    await this.stores.working.open();
    await this.stores.episodic.open();
    await this.stores.semantic.open();
    if (this.policy.globalEnabled) {
      await this.stores.global.open();
    }
    this.opened = true;
  }

  async close(): Promise<void> {
    if (!this.opened) return;
    await this.stores.working.close();
    await this.stores.episodic.close();
    await this.stores.semantic.close();
    await this.stores.global.close();
    this.opened = false;
  }

  store(tier: Tier): TierStore {
    if (tier === "global" && !this.policy.globalEnabled) {
      throw new Error("Global tier not enabled. Set memory.tiers.global.enabled=true");
    }
    return this.stores[tier];
  }

  async write(tier: Tier, entry: Omit<MemoryEntry, "tier">): Promise<void> {
    await this.store(tier).write(entry);
  }

  async query(tier: Tier, q: MemoryQuery): Promise<MemoryEntry[]> {
    return this.store(tier).query(q);
  }

  async planCleanupForScope(scope: string): Promise<CleanupPlan[]> {
    const now = Date.now();
    const plans: CleanupPlan[] = [];

    const workingTTL = parseDuration(this.policy.workingTTL);
    if (workingTTL !== null) {
      plans.push(
        await this.stores.working.planCleanup({
          scope,
          olderThan: now - workingTTL,
          strategy: this.policy.cleanup,
          keepProtected: true,
          keepCheckpoints: true,
        }),
      );
    }

    const episodicTTL = parseDuration(this.policy.episodicTTL);
    if (episodicTTL !== null) {
      plans.push(
        await this.stores.episodic.planCleanup({
          scope,
          olderThan: now - episodicTTL,
          strategy: this.policy.cleanup,
          keepProtected: true,
          keepCheckpoints: true,
        }),
      );
    }

    const semanticTTL = parseDuration(this.policy.semanticTTL);
    if (semanticTTL !== null) {
      plans.push(
        await this.stores.semantic.planCleanup({
          scope,
          olderThan: now - semanticTTL,
          strategy: this.policy.cleanup,
          keepProtected: true,
          keepCheckpoints: true,
        }),
      );
    }

    return plans;
  }

  async executeCleanup(plans: CleanupPlan[]): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    for (const plan of plans) {
      const result = await this.store(plan.tier).executeCleanup(plan);
      results.push(result);
    }
    return results;
  }

  async sweepAllExpired(): Promise<Record<Tier, number>> {
    return {
      working: await this.stores.working.sweepExpired(),
      episodic: await this.stores.episodic.sweepExpired(),
      semantic: await this.stores.semantic.sweepExpired(),
      global: this.policy.globalEnabled ? await this.stores.global.sweepExpired() : 0,
    };
  }

  async stats(scope?: string): Promise<Record<Tier, { count: number; bytes: number }>> {
    return {
      working: {
        count: await this.stores.working.count(scope),
        bytes: await this.stores.working.sizeBytes(scope),
      },
      episodic: {
        count: await this.stores.episodic.count(scope),
        bytes: await this.stores.episodic.sizeBytes(scope),
      },
      semantic: {
        count: await this.stores.semantic.count(scope),
        bytes: await this.stores.semantic.sizeBytes(scope),
      },
      global: this.policy.globalEnabled
        ? {
            count: await this.stores.global.count(scope),
            bytes: await this.stores.global.sizeBytes(scope),
          }
        : { count: 0, bytes: 0 },
    };
  }

  async vacuum(): Promise<void> {
    await this.stores.working.vacuum();
    await this.stores.episodic.vacuum();
    await this.stores.semantic.vacuum();
    if (this.policy.globalEnabled) await this.stores.global.vacuum();
  }

  async exportScope(scope?: string): Promise<Record<Tier, MemoryEntry[]>> {
    const allTiers: Tier[] = ["working", "episodic", "semantic"];
    if (this.policy.globalEnabled) allTiers.push("global");
    const out: Partial<Record<Tier, MemoryEntry[]>> = {};
    for (const t of allTiers) {
      out[t] = await this.stores[t].query({ scope, limit: 1000000 });
    }
    return out as Record<Tier, MemoryEntry[]>;
  }

  async importDump(dump: Record<Tier, MemoryEntry[]>): Promise<number> {
    let count = 0;
    for (const [tier, entries] of Object.entries(dump)) {
      const t = tier as Tier;
      if (t === "global" && !this.policy.globalEnabled) continue;
      for (const e of entries) {
        await this.stores[t].write({ ...e });
        count++;
      }
    }
    return count;
  }
}
