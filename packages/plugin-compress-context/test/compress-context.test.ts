import { describe, it, expect } from "vitest";
import {
  compressRange,
  estimateMessagesTokens,
  shouldTriggerCompression,
  type ConversationMessage,
} from "../src/index.js";

const DEFAULT_CFG = {
  enabled: true,
  mode: "smart" as const,
  minTokensTrigger: 20000,
  maxTokensTrigger: 100000,
  triggers: {
    onTaskComplete: true,
    onMilestone: true,
    onContextPressure: true,
    onTopicShift: true,
    onIdle: false,
  },
  preserve: {
    decisionKB: true,
    docsKB: false,
    codeKB: false,
    userMessages: false,
    checkpoints: true,
    protectedTags: true,
  },
  protectPatterns: [],
};

describe("estimateMessagesTokens", () => {
  it("sums character-based estimates", () => {
    const msgs: ConversationMessage[] = [
      { role: "user", content: "a".repeat(100) },
      { role: "assistant", content: "b".repeat(200) },
    ];
    expect(estimateMessagesTokens(msgs)).toBe(75);
  });
});

describe("shouldTriggerCompression", () => {
  it("does not trigger below minTokensTrigger", () => {
    const msgs: ConversationMessage[] = [{ role: "user", content: "short" }];
    expect(shouldTriggerCompression(msgs, DEFAULT_CFG, "onTaskComplete", 100000)).toBe(false);
  });

  it("always triggers above maxTokensTrigger", () => {
    const msgs: ConversationMessage[] = [{ role: "user", content: "x".repeat(500000) }];
    expect(shouldTriggerCompression(msgs, DEFAULT_CFG, "onIdle", 100000)).toBe(true);
  });

  it("respects mode=manual", () => {
    const msgs: ConversationMessage[] = [{ role: "user", content: "x".repeat(200000) }];
    expect(
      shouldTriggerCompression(msgs, { ...DEFAULT_CFG, mode: "manual" }, "onTaskComplete", 100000),
    ).toBe(false);
  });
});

describe("compressRange", () => {
  it("preserves checkpoint messages", () => {
    const msgs: ConversationMessage[] = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b", isCheckpoint: true },
      { role: "user", content: "c" },
    ];
    const r = compressRange(msgs, 0, 3, DEFAULT_CFG);
    expect(r.compressed.some((m) => m.isCheckpoint)).toBe(true);
  });

  it("preserves decisions when decisionKB=true", () => {
    const msgs: ConversationMessage[] = [
      { role: "assistant", content: "we chose TypeScript", isDecision: true },
      { role: "assistant", content: "regular reply" },
    ];
    const r = compressRange(msgs, 0, 2, DEFAULT_CFG);
    expect(r.compressed.some((m) => m.isDecision)).toBe(true);
  });

  it("preserves protected messages", () => {
    const msgs: ConversationMessage[] = [
      { role: "system", content: "AGENTS.md content", isProtected: true },
      { role: "assistant", content: "noise" },
    ];
    const r = compressRange(msgs, 0, 2, DEFAULT_CFG);
    expect(r.compressed.some((m) => m.isProtected)).toBe(true);
  });

  it("reduces total token count", () => {
    const msgs: ConversationMessage[] = Array.from({ length: 50 }, (_, i) => ({
      role: "assistant",
      content: `verbose message ${i} `.repeat(100),
    }));
    const r = compressRange(msgs, 0, 50, DEFAULT_CFG);
    expect(r.tokensSaved).toBeGreaterThan(0);
    expect(r.removed).toBe(50);
  });
});
