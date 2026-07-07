// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { Observer } from "../src/observer";
import { SELF_LEARNING_MIGRATIONS } from "../src/migrations/530-observer";
import { BasicPiiFilter } from "../src/types";

const PROJECT = "blake3:proj0001";
const BRANCH = "blake3:branchmain";
const SESSION = "01J3X8H9SESSION0000000000";

function setupDb(): DB {
  const db = new Database(":memory:");
  for (const m of SELF_LEARNING_MIGRATIONS) {
    db.exec(m.up);
  }
  return db;
}

describe("Observer", () => {
  let db: DB;
  let observer: Observer;

  beforeEach(() => {
    db = setupDb();
    observer = new Observer({ db });
  });

  afterEach(() => db.close());

  it("captures an event by default (opt-out enabled)", () => {
    const event = observer.capture({
      projectId: PROJECT,
      branchId: BRANCH,
      sessionId: SESSION,
      actorKind: "agent",
      actorId: "claude-code",
      actionKind: "shell_command",
      actionPayload: { command: "npm test" },
      outcomeKind: "success",
      outcomeDurationMs: 4200,
    });
    expect(event).not.toBeNull();
    expect(observer.count(PROJECT)).toBe(1);
  });

  it("drops events when observer disabled at project level", () => {
    observer.setConfig("project", PROJECT, { enabled: false });
    const event = observer.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: "agent",
      actorId: "x",
      actionKind: "tool_call",
      actionPayload: {},
    });
    expect(event).toBeNull();
    expect(observer.count(PROJECT)).toBe(0);
  });

  it("drops events when disabled at session level (most restrictive)", () => {
    observer.setConfig("session", SESSION, { enabled: false });
    const event = observer.capture({
      projectId: PROJECT,
      branchId: BRANCH,
      sessionId: SESSION,
      actorKind: "user",
      actorId: "milo",
      actionKind: "file_edit",
      actionPayload: {},
    });
    expect(event).toBeNull();
  });

  it("applies PII filter and records redaction", () => {
    const obs = new Observer({ db, piiFilter: new BasicPiiFilter() });
    const event = obs.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: "user",
      actorId: "milo",
      actionKind: "chat_message",
      actionPayload: { text: "email me at milo@example.com" },
    });
    expect(event?.pii_redaction_applied).toBe(true);
    expect(JSON.stringify(event?.action_payload)).toContain("[REDACTED:email]");
  });

  it("queries by action kind", () => {
    observer.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: "agent",
      actorId: "x",
      actionKind: "test_run",
      actionPayload: {},
    });
    observer.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: "agent",
      actorId: "x",
      actionKind: "git_operation",
      actionPayload: {},
    });

    const tests = observer.query({ projectId: PROJECT, actionKind: "test_run" });
    expect(tests).toHaveLength(1);
  });

  it("queries scoped to a session", () => {
    observer.capture({
      projectId: PROJECT,
      sessionId: SESSION,
      actorKind: "agent",
      actorId: "x",
      actionKind: "tool_call",
      actionPayload: {},
    });
    observer.capture({
      projectId: PROJECT,
      sessionId: "other-session",
      actorKind: "agent",
      actorId: "x",
      actionKind: "tool_call",
      actionPayload: {},
    });

    const scoped = observer.query({ projectId: PROJECT, sessionId: SESSION });
    expect(scoped).toHaveLength(1);
  });

  it("records 3-level context + parent_session_id for subagent", () => {
    const event = observer.capture({
      projectId: PROJECT,
      branchId: BRANCH,
      sessionId: "subagent-session",
      parentSessionId: SESSION,
      actorKind: "subagent",
      actorId: "test-runner",
      actionKind: "shell_command",
      actionPayload: { command: "pytest" },
    });
    expect(event?.parent_session_id).toBe(SESSION);
    expect(event?.actor_kind).toBe("subagent");
  });

  it("config defaults to enabled (opt-out)", () => {
    const cfg = observer.getConfig("project", PROJECT);
    expect(cfg.enabled).toBe(true);
    expect(cfg.piiFilterEnabled).toBe(true);
    expect(cfg.notifyOnFirstLaunch).toBe(true);
  });
});
