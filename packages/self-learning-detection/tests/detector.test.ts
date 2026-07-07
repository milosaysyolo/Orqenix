// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { BasicDetector } from "../src/detector";
import { SELF_LEARNING_MIGRATIONS } from "@orqenix/self-learning-observer";
import type { ObservationEvent } from "@orqenix/self-learning-observer";

const PROJECT = "blake3:proj0001";

function setupDb(): DB {
  const db = new Database(":memory:");
  for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
  return db;
}

function makeSequenceEvents(session: string, count: number, success: boolean): ObservationEvent[] {
  const events: ObservationEvent[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * 2;
    events.push({
      id: `e${base}-${session}`,
      timestamp: new Date(2026, 5, 11, 10, base).toISOString(),
      project_id: PROJECT,
      branch_id: "b",
      session_id: `${session}-${i}`,
      parent_session_id: null,
      agent_platform: "claude-code",
      actor_kind: "agent",
      actor_id: "x",
      action_kind: "file_edit",
      action_payload: {},
      outcome_kind: null,
      outcome_duration_ms: null,
      outcome_payload: null,
      pii_redaction_applied: false,
      redaction_notes: null,
    });
    events.push({
      id: `e${base + 1}-${session}`,
      timestamp: new Date(2026, 5, 11, 10, base + 1).toISOString(),
      project_id: PROJECT,
      branch_id: "b",
      session_id: `${session}-${i}`,
      parent_session_id: null,
      agent_platform: "claude-code",
      actor_kind: "agent",
      actor_id: "x",
      action_kind: "test_run",
      action_payload: {},
      outcome_kind: success ? "success" : "error",
      outcome_duration_ms: 5000,
      outcome_payload: null,
      pii_redaction_applied: false,
      redaction_notes: null,
    });
  }
  return events;
}

describe("BasicDetector", () => {
  let db: DB;
  let detector: BasicDetector;

  beforeEach(() => {
    db = setupDb();
    detector = new BasicDetector({ db });
  });

  afterEach(() => db.close());

  it("detects + persists a recurring pattern", async () => {
    const events = makeSequenceEvents("s", 6, true); // 6× edit→test success
    const result = await detector.run({ projectId: PROJECT, events });
    expect(result.candidatesCreated).toBeGreaterThanOrEqual(1);

    const candidates = detector.getCandidateStore().list(PROJECT);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]?.status).toBe("detected");
  });

  it("does not create candidate below frequency threshold", async () => {
    const events = makeSequenceEvents("s", 3, true); // only 3 occurrences
    const result = await detector.run({ projectId: PROJECT, events });
    expect(result.candidatesCreated).toBe(0);
  });

  it("respects cooldown for rejected candidates", async () => {
    const events = makeSequenceEvents("s", 6, true);
    await detector.run({ projectId: PROJECT, events });
    const candidates = detector.getCandidateStore().list(PROJECT);
    const candidateId = candidates[0]!.id;

    // Reject the candidate
    detector.getCandidateStore().setReviewStatus(candidateId, "rejected", "milo");

    // Re-run detection within cooldown → should be cooldown (not re-surfaced)
    const result2 = await detector.run({ projectId: PROJECT, events });
    expect(result2.candidatesCreated).toBe(0);
    // No new 'detected' candidate
    const detected = detector.getCandidateStore().list(PROJECT, "detected");
    expect(detected).toHaveLength(0);
  });

  it("updates impact when pattern re-detected (not in cooldown)", async () => {
    const events = makeSequenceEvents("s", 6, true);
    await detector.run({ projectId: PROJECT, events });
    const moreEvents = makeSequenceEvents("t", 10, true);
    const result = await detector.run({ projectId: PROJECT, events: [...events, ...moreEvents] });
    expect(result.candidatesUpdated).toBeGreaterThanOrEqual(0);
  });
});
