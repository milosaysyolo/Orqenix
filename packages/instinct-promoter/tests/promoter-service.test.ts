// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { PromoterService } from "../src/promoter-service";
import { SELF_LEARNING_MIGRATIONS } from "@orqenix/self-learning-observer";
import { CandidateStore } from "@orqenix/self-learning-detection";

const PROJECT = "blake3:proj0001";

function setupDb(): DB {
  const db = new Database(":memory:");
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  return db;
}

function seedCandidate(db: DB, id: string): void {
  db.prepare(
    `INSERT INTO instinct_candidates (
      id, project_id, branch_id, session_id, pattern_hash, pattern_name,
      pattern_description, observation_count, success_count, total_count,
      success_rate, sample_observation_ids, detected_at, impact_score,
      status, reviewed_at, reviewed_by, review_decision, cross_scope, cross_scope_sources_json
    ) VALUES (?, ?, NULL, NULL, ?, ?, ?, 6, 6, 6, 1.0, '[]', ?, 8.5, 'detected', NULL, NULL, NULL, 0, NULL)`,
  ).run(
    id,
    PROJECT,
    `hash-${id}`,
    "@local/test-then-commit",
    "Test then commit",
    new Date().toISOString(),
  );
}

describe("PromoterService", () => {
  let db: DB;
  let service: PromoterService;

  beforeEach(() => {
    db = setupDb();
    // Mock skill genesis to avoid full code synthesis in this test
    const mockGenesis = {
      generateFromCandidate: async () => ({ skillName: "@local/generated", csfHash: "abc" }),
    };
    service = new PromoterService({ db, skillGenesis: mockGenesis as never });
  });

  afterEach(() => db.close());

  it("lists candidates ranked by impact", async () => {
    seedCandidate(db, "c1");
    const candidates = await service.listForReview(PROJECT);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.patternName).toBe("@local/test-then-commit");
    expect(candidates[0]?.impactScore).toBe(8.5);
  });

  it("reject marks candidate rejected", async () => {
    seedCandidate(db, "c2");
    const result = await service.review(
      { candidateId: "c2", action: "reject", reviewedBy: "milo", reason: "not useful" },
      PROJECT,
    );
    expect(result.action).toBe("reject");
    const store = new CandidateStore(db);
    expect(store.get("c2")?.status).toBe("rejected");
  });

  it("defer marks candidate deferred", async () => {
    seedCandidate(db, "c3");
    const result = await service.review(
      { candidateId: "c3", action: "defer", reviewedBy: "milo" },
      PROJECT,
    );
    expect(result.action).toBe("defer");
    const store = new CandidateStore(db);
    expect(store.get("c3")?.status).toBe("deferred");
  });

  it("promote generates a skill + marks promoted", async () => {
    seedCandidate(db, "c4");
    const result = await service.review(
      { candidateId: "c4", action: "promote", reviewedBy: "milo" },
      PROJECT,
    );
    expect(result.action).toBe("promote");
    expect(result.generatedSkillName).toBe("@local/generated");
    const store = new CandidateStore(db);
    expect(store.get("c4")?.status).toBe("promoted");
  });

  it("promote_customize opens builder + marks reviewed", async () => {
    seedCandidate(db, "c5");
    const result = await service.review(
      { candidateId: "c5", action: "promote_customize", reviewedBy: "milo" },
      PROJECT,
    );
    expect(result.openBuilder).toBe(true);
    const store = new CandidateStore(db);
    expect(store.get("c5")?.status).toBe("reviewed");
  });

  it('detects convergence when last N results are identical', async () => {
    seedCandidate(db, 'c6');
    const candidates = await service.listForReview(PROJECT);
    const hashes = candidates.map((c) => `pattern-${c.patternName}`);

    // Record 3 identical results
    service.recordIterationResult(hashes);
    service.recordIterationResult(hashes);
    service.recordIterationResult(hashes);

    expect(service.checkConvergence()).toBe(true);
  });

  it('does not converge before window is filled', async () => {
    seedCandidate(db, 'c7');
    const candidates = await service.listForReview(PROJECT);
    const hashes = candidates.map((c) => `pattern-${c.patternName}`);

    service.recordIterationResult(hashes);
    expect(service.checkConvergence()).toBe(false);
  });

  it('getConvergenceStatus returns correct snapshot', async () => {
    seedCandidate(db, 'c8');
    const candidates = await service.listForReview(PROJECT);
    const hashes = candidates.map((c) => `pattern-${c.patternName}`);

    service.recordIterationResult(hashes);
    const status = service.getConvergenceStatus();
    expect(status.windowSize).toBeGreaterThan(0);
    expect(status.recordedIterations).toBe(1);
    expect(status.converged).toBe(false);
  });

  it('resetConvergenceTracking clears recorded results', async () => {
    seedCandidate(db, 'c9');
    const candidates = await service.listForReview(PROJECT);
    const hashes = candidates.map((c) => `pattern-${c.patternName}`);

    service.recordIterationResult(hashes);
    service.resetConvergenceTracking();
    expect(service.getConvergenceStatus().recordedIterations).toBe(0);
  });

  it('throws for unknown candidate', async () => {
    await expect(
      service.review({ candidateId: "nope", action: "reject", reviewedBy: "milo" }, PROJECT),
    ).rejects.toThrow(/not found/);
  });
});
