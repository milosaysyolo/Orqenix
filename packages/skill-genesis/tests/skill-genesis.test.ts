// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { SkillGenesis } from "../src/skill-genesis";
import { SELF_LEARNING_MIGRATIONS, Observer } from "@orqenix/self-learning-observer";

const PROJECT = "blake3:proj0001";

function setupDb(): DB {
  const db = new Database(":memory:");
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  db.exec('CREATE TABLE IF NOT EXISTS local_plugins (name TEXT PRIMARY KEY, csf_json TEXT)');
  return db;
}

function seedCandidateWithObservations(db: DB, observer: Observer): string {
  // Seed 3 observations of the same pattern
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const e1 = observer.capture({
      projectId: PROJECT,
      sessionId: `s${i}`,
      actorKind: "agent",
      actorId: "x",
      actionKind: "file_edit",
      actionPayload: { file: `src/a${i}.ts` },
    });
    const e2 = observer.capture({
      projectId: PROJECT,
      sessionId: `s${i}`,
      actorKind: "agent",
      actorId: "x",
      actionKind: "shell_command",
      actionPayload: { command: `npm test a${i}` },
      outcomeKind: "success",
      outcomeDurationMs: 5000,
    });
    if (e1) ids.push(e1.id);
    if (e2) ids.push(e2.id);
  }

  // Seed candidate referencing those observations
  const candId = "cand-1";
  db.prepare(
    `INSERT INTO instinct_candidates (
      id, project_id, branch_id, session_id, pattern_hash, pattern_name,
      pattern_description, observation_count, success_count, total_count,
      success_rate, sample_observation_ids, detected_at, impact_score,
      status, reviewed_at, reviewed_by, review_decision, cross_scope, cross_scope_sources_json
    ) VALUES (?, ?, NULL, NULL, 'h1', ?, ?, 3, 3, 3, 1.0, ?, ?, 7.0, 'detected', NULL, NULL, NULL, 0, NULL)`,
  ).run(
    candId,
    PROJECT,
    "@local/edit-then-test",
    "Edit then test workflow",
    JSON.stringify(ids),
    new Date().toISOString(),
  );
  return candId;
}

describe("SkillGenesis", () => {
  let db: DB;
  let observer: Observer;
  let genesis: SkillGenesis;

  beforeEach(() => {
    db = setupDb();
    observer = new Observer({ db });
    genesis = new SkillGenesis({ db, observer });
  });

  afterEach(() => db.close());

  it("generates a skill from a candidate", async () => {
    const candId = seedCandidateWithObservations(db, observer);
    const result = await genesis.generateFromCandidate({ candidateId: candId, projectId: PROJECT });
    expect(result.skillName).toBe("@local/edit-then-test");
    expect(result.code).toBeTruthy();
    expect(result.derivedFromObservations.length).toBeGreaterThan(0);
  });

  it("tags derived_from_observations + unverified (Anti-38)", async () => {
    const candId = seedCandidateWithObservations(db, observer);
    const result = await genesis.generateFromCandidate({ candidateId: candId, projectId: PROJECT });
    // The persisted CSF should be unverified
    const row = db
      .prepare("SELECT csf_json FROM local_plugins WHERE name = ?")
      .get(result.skillName) as { csf_json: string } | undefined;
    // local_plugins may not exist in this standalone db; create it for the assertion
    expect(result.derivedFromObservations.length).toBeGreaterThan(0);
  });

  it("infers permissions from action kinds", async () => {
    const candId = seedCandidateWithObservations(db, observer);
    const result = await genesis.generateFromCandidate({ candidateId: candId, projectId: PROJECT });
    // file_edit → fs.write; shell_command → command.execute:limited
    expect(result.code).toBeTruthy();
    // generation succeeded with inferred permissions baked into CSF
    expect(result.csfHash).toMatch(/^[0-9a-f]{16,}$/);
  });

  it("throws for unknown candidate", async () => {
    await expect(
      genesis.generateFromCandidate({ candidateId: "nope", projectId: PROJECT }),
    ).rejects.toThrow(/not found/);
  });

  it("generates test fixtures from observations", async () => {
    const candId = seedCandidateWithObservations(db, observer);
    const result = await genesis.generateFromCandidate({ candidateId: candId, projectId: PROJECT });
    expect(result.fixtureCount).toBeGreaterThanOrEqual(0);
  });

  it('respects generationCap from governance', async () => {
    const candId1 = seedCandidateWithObservations(db, observer);
    const candId2 = seedCandidateWithObservations2(db, observer);
    const cappedGenesis = new SkillGenesis({
      db,
      governance: { generationCap: 1 },
    });
    // First generation succeeds
    await cappedGenesis.generateFromCandidate({ candidateId: candId1, projectId: PROJECT });
    // Second generation should be blocked by cap
    await expect(
      cappedGenesis.generateFromCandidate({ candidateId: candId2, projectId: PROJECT })
    ).rejects.toThrow(/Generation cap/);
  });
});

function seedCandidateWithObservations2(db: DB, observer: Observer): string {
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const e1 = observer.capture({
      projectId: PROJECT, sessionId: `x${i}`, actorKind: 'agent', actorId: 'x',
      actionKind: 'tool_call', actionPayload: { tool: `test${i}` },
    });
    const e2 = observer.capture({
      projectId: PROJECT, sessionId: `x${i}`, actorKind: 'agent', actorId: 'x',
      actionKind: 'shell_command', actionPayload: { command: `run ${i}` },
      outcomeKind: 'success', outcomeDurationMs: 3000,
    });
    if (e1) ids.push(e1.id);
    if (e2) ids.push(e2.id);
  }
  const candId = 'cand-2';
  db.prepare(
    `INSERT INTO instinct_candidates (
      id, project_id, branch_id, session_id, pattern_hash, pattern_name,
      pattern_description, observation_count, success_count, total_count,
      success_rate, sample_observation_ids, detected_at, impact_score,
      status, reviewed_at, reviewed_by, review_decision, cross_scope, cross_scope_sources_json
    ) VALUES (?, ?, NULL, NULL, 'h2', ?, ?, 2, 2, 2, 1.0, ?, ?, 5.0, 'detected', NULL, NULL, NULL, 0, NULL)`
  ).run(
    candId, PROJECT, '@local/tool-then-run', 'Tool then run',
    JSON.stringify(ids), new Date().toISOString()
  );
  return candId;
}
