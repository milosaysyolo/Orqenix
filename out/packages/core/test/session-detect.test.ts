import { describe, it, expect, beforeEach, vi } from "vitest";
import { detectSession } from "../src/scope/session-detect.js";

describe("session-detect", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const k of [
      "OPENCODE_SESSION_ID",
      "CLAUDE_SESSION_ID",
      "CURSOR_SESSION_ID",
      "CODEX_SESSION_ID",
      "ANTIGRAVITY_SESSION_ID",
      "MCP_SESSION_ID",
    ]) {
      vi.stubEnv(k, "");
    }
  });

  it("generates a session ID when nothing is configured", async () => {
    const id = await detectSession();
    expect(id).toMatch(/^s-\d{14}-[a-f0-9]{6}$/);
  });

  it("prefers OpenCode env when set", async () => {
    vi.stubEnv("OPENCODE_SESSION_ID", "abc");
    const id = await detectSession();
    expect(id).toBe("oc-abc");
  });

  it("falls back to Claude when OpenCode missing", async () => {
    vi.stubEnv("CLAUDE_SESSION_ID", "xyz");
    const id = await detectSession();
    expect(id).toBe("cc-xyz");
  });

  it("falls back to MCP env last", async () => {
    vi.stubEnv("MCP_SESSION_ID", "mcp-123");
    const id = await detectSession();
    expect(id).toBe("mcp-mcp-123");
  });
});
