/**
 * Agent file format (OpenCode-compatible Markdown with YAML frontmatter).
 * See CHAPTER 2 and 7 of the spec.
 */

export type AgentMode = "primary" | "subagent" | "all";

export interface AgentToolsConfig {
  [tool: string]: boolean;
}

export interface AgentPermissionConfig {
  [op: string]: "ask" | "allow" | "deny" | Record<string, "ask" | "allow" | "deny">;
}

/** OpenCode-native frontmatter fields. */
export interface OpenCodeFrontmatter {
  description: string;
  mode?: AgentMode;
  model?: string;
  temperature?: number;
  tools?: AgentToolsConfig;
  permission?: AgentPermissionConfig;
  prompt?: string;
  maxSteps?: number;
  disable?: boolean;
}

/** Orqenix extension under the `orqenix:` key. */
export interface OrqenixAgentExtension {
  team?: string;
  role?: string;
  isTeamLead?: boolean;
  managesAgents?: string[];
  lazyAgents?: string[];
  fallback_model?: string;
  costBudgetTokens?: number;
  protect_context?: boolean;

  // Knowledge workflow contract (Chapter 12)
  knowledge_briefing?: boolean;
  briefing_kbs?: Array<"decisions" | "docs" | "code">;
  briefing_max_tokens?: number;
  capture_decisions?: boolean;
  reindex_after?: "auto" | "code" | "docs" | "both" | "none";
  writes?: Array<"code" | "docs" | "tests" | "config">;
}

export interface AgentFrontmatter extends OpenCodeFrontmatter {
  orqenix?: OrqenixAgentExtension;
}

export interface AgentFile {
  /** Logical agent name (derived from filename, no extension). */
  name: string;
  /** Absolute path to source file. */
  sourcePath: string;
  frontmatter: AgentFrontmatter;
  body: string;
  /** BLAKE3 hash of full file content. */
  contentHash: string;
}
