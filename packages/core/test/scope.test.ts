import { describe, it, expect } from "vitest";
import { generateScopeId, generateSessionId } from "../src/scope/id-generator.js";

describe("scope/id-generator", () => {
  it("is deterministic for identical descriptors", () => {
    const a = generateScopeId({
      project: "/home/u/proj",
      branch: "dev",
      worktree: "/home/u/proj",
      session: "s-fixed",
    });
    const b = generateScopeId({
      project: "/home/u/proj",
      branch: "dev",
      worktree: "/home/u/proj",
      session: "s-fixed",
    });
    expect(a.hash).toBe(b.hash);
    expect(a.short).toBe(b.short);
    expect(a.full).toBe(b.full);
  });

  it("differs when worktree differs", () => {
    const a = generateScopeId({ project: "/p", branch: "dev", worktree: "/p/wt-a", session: "s1" });
    const b = generateScopeId({ project: "/p", branch: "dev", worktree: "/p/wt-b", session: "s1" });
    expect(a.hash).not.toBe(b.hash);
  });

  it("differs when session differs (same other fields)", () => {
    const a = generateScopeId({ project: "/p", branch: "d", worktree: "/p", session: "s1" });
    const b = generateScopeId({ project: "/p", branch: "d", worktree: "/p", session: "s2" });
    expect(a.hash).not.toBe(b.hash);
  });

  it("uses _default org when none provided", () => {
    const a = generateScopeId({ project: "/p", branch: "main", worktree: "/p", session: "s1" });
    expect(a.descriptor.org).toBe("_default");
    expect(a.full.startsWith("_default/")).toBe(true);
  });

  it("full string contains exactly 5 segments", () => {
    const a = generateScopeId({ project: "/p", branch: "main", worktree: "/p", session: "s1" });
    expect(a.full.split("/").length).toBe(5);
  });

  it("session ID has correct shape", () => {
    expect(generateSessionId()).toMatch(/^s-\d{14}-[a-f0-9]{6}$/);
  });
});
