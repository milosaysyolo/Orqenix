import { describe, it, expect } from "vitest";
import { deduplicateMessages, injectConcision, removeWhitespaceNoise } from "../src/index.js";

describe("removeWhitespaceNoise", () => {
  it("collapses multiple blank lines", () => {
    const r = removeWhitespaceNoise("a\n\n\n\nb", false);
    expect(r).toBe("a\n\nb");
  });

  it("preserves code blocks when flag set", () => {
    const input = "text\n\n\n\n```js\n\n\n\ncode\n```\nmore\n\n\n\ntext";
    const r = removeWhitespaceNoise(input, true);
    expect(r).toContain("```js\n\n\n\ncode\n```");
    expect(r).toContain("more\n\ntext");
  });

  it("strips trailing whitespace before newline", () => {
    expect(removeWhitespaceNoise("a   \nb", false)).toBe("a\nb");
  });
});

describe("deduplicateMessages", () => {
  it("removes adjacent identical messages from same role", () => {
    const r = deduplicateMessages([
      { role: "user", content: "hi" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(r).toHaveLength(2);
  });

  it("keeps consecutive different-role messages", () => {
    const r = deduplicateMessages([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hi" },
    ]);
    expect(r).toHaveLength(2);
  });

  it("normalizes whitespace in comparison", () => {
    const r = deduplicateMessages([
      { role: "user", content: "  hi  " },
      { role: "user", content: "hi" },
    ]);
    expect(r).toHaveLength(1);
  });
});

describe("injectConcision", () => {
  it("adds system message if none exists", () => {
    const r = injectConcision([{ role: "user", content: "hi" }]);
    expect(r).toHaveLength(2);
    expect(r[0]?.role).toBe("system");
    expect(r[0]?.content).toContain("OUTPUT GUIDELINES");
  });

  it("appends to existing system message", () => {
    const r = injectConcision([
      { role: "system", content: "you are helpful" },
      { role: "user", content: "hi" },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]?.content).toContain("you are helpful");
    expect(r[0]?.content).toContain("OUTPUT GUIDELINES");
  });

  it("is idempotent", () => {
    const first = injectConcision([{ role: "user", content: "hi" }]);
    const second = injectConcision(first);
    expect(second).toEqual(first);
  });
});
