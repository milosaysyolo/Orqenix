// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , SkillRuntimeExecutor tests
import { describe, it, expect } from "vitest";
import { SkillRuntimeExecutor } from "../src/skill-runtime-executor";
import type { SkillRuntime } from "@orqenix/skill-runtime";

function fakeRuntime(output: unknown, throws = false): SkillRuntime {
  return {
    invoke: async () => {
      if (throws) throw new Error("boom");
      return { output };
    },
  } as unknown as SkillRuntime;
}

describe("SkillRuntimeExecutor", () => {
  it("maps success output to success outcome", async () => {
    const ex = new SkillRuntimeExecutor(fakeRuntime({ success: true }));
    const r = await ex.replay({
      skillName: "s",
      input: {},
      expectedOutcome: "success",
    });
    expect(r).toEqual({ matched: true, actualOutcome: "success" });
  });

  it("maps explicit failure output to error outcome", async () => {
    const ex = new SkillRuntimeExecutor(fakeRuntime({ success: false }));
    const r = await ex.replay({
      skillName: "s",
      input: {},
      expectedOutcome: "error",
    });
    expect(r).toEqual({ matched: true, actualOutcome: "error" });
  });

  it("maps ambiguous output to partial outcome", async () => {
    const ex = new SkillRuntimeExecutor(fakeRuntime({ ok: 1 }));
    const r = await ex.replay({
      skillName: "s",
      input: {},
      expectedOutcome: "success",
    });
    expect(r.actualOutcome).toBe("partial");
    expect(r.matched).toBe(false);
  });

  it("treats thrown errors as error outcome", async () => {
    const ex = new SkillRuntimeExecutor(fakeRuntime(null, true));
    const r = await ex.replay({
      skillName: "s",
      input: {},
      expectedOutcome: "error",
    });
    expect(r).toEqual({ matched: true, actualOutcome: "error" });
  });
});
