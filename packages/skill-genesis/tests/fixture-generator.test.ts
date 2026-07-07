// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { FixtureGenerator } from "../src/fixture-generator";
import type { ObservationEvent } from "@orqenix/self-learning-observer";
import type { InferredParameter } from "../src/types";

function ev(
  session: string,
  action: string,
  payload: Record<string, unknown>,
  ts: string,
  outcome: "success" | "error" | null,
): ObservationEvent {
  return {
    id: `e-${session}-${action}`,
    timestamp: ts,
    project_id: "p",
    branch_id: "b",
    session_id: session,
    parent_session_id: null,
    agent_platform: "cc",
    actor_kind: "agent",
    actor_id: "x",
    action_kind: action,
    action_payload: payload,
    outcome_kind: outcome,
    outcome_duration_ms: outcome ? 1000 : null,
    outcome_payload: null,
    pii_redaction_applied: false,
    redaction_notes: null,
  };
}

const params: InferredParameter[] = [
  { name: "message", type: "string", variable: true, samples: [], required: true },
];

describe("FixtureGenerator", () => {
  it("generates positive fixture from successful session", () => {
    const gen = new FixtureGenerator();
    const events = [
      ev("s1", "file_edit", { message: "hi" }, "2026-06-11T10:00:00Z", null),
      ev("s1", "shell_command", {}, "2026-06-11T10:00:05Z", "success"),
    ];
    const fixtures = gen.generate(events, params);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.expectedOutcome).toBe("success");
    expect(fixtures[0]?.input.message).toBe("hi");
  });

  it("generates negative fixture from error session", () => {
    const gen = new FixtureGenerator();
    const events = [
      ev("s2", "file_edit", { message: "bad" }, "2026-06-11T10:00:00Z", null),
      ev("s2", "shell_command", {}, "2026-06-11T10:00:05Z", "error"),
    ];
    const fixtures = gen.generate(events, params);
    expect(fixtures[0]?.expectedOutcome).toBe("error");
  });

  it("caps fixtures at 10", () => {
    const gen = new FixtureGenerator();
    const events: ObservationEvent[] = [];
    for (let i = 0; i < 15; i++) {
      events.push(ev(`s${i}`, "tool_call", { x: i }, `2026-06-11T10:0${i}:00Z`, "success"));
    }
    const fixtures = gen.generate(events, [
      { name: "x", type: "number", variable: true, samples: [], required: true },
    ]);
    expect(fixtures.length).toBeLessThanOrEqual(10);
  });

  it("skips sessions without terminal outcome", () => {
    const gen = new FixtureGenerator();
    const events = [ev("s3", "file_read", {}, "2026-06-11T10:00:00Z", null)];
    const fixtures = gen.generate(events, params);
    expect(fixtures).toHaveLength(0);
  });
});
