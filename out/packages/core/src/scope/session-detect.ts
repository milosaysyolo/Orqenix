import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { userHome } from "../util/paths.js";
import { generateSessionId } from "./id-generator.js";

type Detector = () => Promise<string | null>;

/**
 * Try to inherit a session ID from the host editor before generating one.
 * Order: OpenCode → Claude Code → Cursor → Codex → Antigravity → MCP env.
 * Falls back to generateSessionId() if none detected.
 * See CHAPTER 5.3 of the spec.
 *
 * @returns Promise resolving to a session ID string
 */
export async function detectSession(): Promise<string> {
  const detectors: Detector[] = [
    detectOpenCodeSession,
    detectClaudeCodeSession,
    detectCursorSession,
    detectCodexSession,
    detectAntigravitySession,
    detectMcpEnvSession,
  ];
  for (const d of detectors) {
    try {
      const id = await d();
      if (id) return id;
    } catch {
      /* swallow detector errors */
    }
  }
  return generateSessionId();
}

async function detectOpenCodeSession(): Promise<string | null> {
  if (process.env.OPENCODE_SESSION_ID) return `oc-${process.env.OPENCODE_SESSION_ID}`;
  const candidates = [
    join(userHome(), ".local", "share", "opencode", "sessions", "current"),
    join(userHome(), ".local", "share", "opencode", "state.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = await readFile(path, "utf-8");
    const data = safeJSON(raw);
    if (data?.sessionId) return `oc-${String(data.sessionId)}`;
    if (data?.id) return `oc-${String(data.id)}`;
  }
  return null;
}

async function detectClaudeCodeSession(): Promise<string | null> {
  if (process.env.CLAUDE_SESSION_ID) return `cc-${process.env.CLAUDE_SESSION_ID}`;
  const path = join(userHome(), ".claude", "sessions", "active.json");
  if (!existsSync(path)) return null;
  const data = safeJSON(await readFile(path, "utf-8"));
  return data?.id ? `cc-${String(data.id)}` : null;
}

async function detectCursorSession(): Promise<string | null> {
  return process.env.CURSOR_SESSION_ID ? `cs-${process.env.CURSOR_SESSION_ID}` : null;
}

async function detectCodexSession(): Promise<string | null> {
  return process.env.CODEX_SESSION_ID ? `cx-${process.env.CODEX_SESSION_ID}` : null;
}

async function detectAntigravitySession(): Promise<string | null> {
  return process.env.ANTIGRAVITY_SESSION_ID ? `ag-${process.env.ANTIGRAVITY_SESSION_ID}` : null;
}

async function detectMcpEnvSession(): Promise<string | null> {
  return process.env.MCP_SESSION_ID ? `mcp-${process.env.MCP_SESSION_ID}` : null;
}

function safeJSON(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
