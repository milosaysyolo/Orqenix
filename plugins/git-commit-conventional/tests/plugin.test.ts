// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { invoke } from "../src/index";

describe("git-commit-conventional reference skill", () => {
  it("generates a basic conventional commit", async () => {
    const result = await invoke({ type: "feat", scope: "auth", description: "add OAuth login" });
    expect(result.message).toBe("feat(auth): add OAuth login");
  });

  it("handles no scope", async () => {
    const result = await invoke({ type: "fix", description: "resolve null pointer" });
    expect(result.message).toBe("fix: resolve null pointer");
  });

  it("marks breaking changes", async () => {
    const result = await invoke({ type: "feat", description: "change API", breakingChange: true });
    expect(result.message).toContain("feat!:");
    expect(result.message).toContain("BREAKING CHANGE:");
  });

  it("includes body", async () => {
    const result = await invoke({
      type: "docs",
      description: "update README",
      body: "Added install section.",
    });
    expect(result.message).toContain("Added install section.");
  });
});
