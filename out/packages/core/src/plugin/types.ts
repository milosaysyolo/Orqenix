import type { ScopeId } from "../types/scope.js";

export interface Task {
  id: string;
  agentName: string;
  intent: string;
  scope: ScopeId;
  startTime: number;
  context: {
    systemPrelude?: string;
    [key: string]: unknown;
  };
  tags?: string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  decisions?: Array<{ type: string; summary: string }>;
  tokens?: { input: number; output: number };
  durationMs: number;
  error?: string;
}

export interface ToolInput {
  toolName: string;
  args: Record<string, unknown>;
  scope: ScopeId;
  callId: string;
}

export interface ToolOutput {
  callId: string;
  result: unknown;
  tokensUsed?: number;
  durationMs: number;
}

export interface MemoryEntry {
  id: string;
  scope: ScopeId;
  tier: "working" | "episodic" | "semantic" | "global";
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  importance?: number;
  protected?: boolean;
}

export interface MemoryQuery {
  scope: ScopeId;
  cluster?: string;
  semantic?: string;
  filter?: Record<string, unknown>;
  topK?: number;
}

export interface KnowledgeQuery {
  text: string;
  scope: ScopeId;
  kbs?: Array<"docs" | "code" | "decisions">;
  topK?: number;
  maxTokens?: number;
}

export interface LLMCall {
  callId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  agentName?: string;
  scope: ScopeId;
}

export interface LLMResponse {
  callId: string;
  content: string;
  tokens: { input: number; output: number };
  durationMs: number;
  finishReason: string;
}

export interface Session {
  id: string;
  scope: ScopeId;
  startedAt: number;
  source: "cli" | "opencode" | "claude-code" | "cursor" | "codex" | "antigravity" | "mcp";
}

export interface PluginContext {
  scope: ScopeId | null;
  config: unknown;
  log: {
    debug: (msg: string, ctx?: Record<string, unknown>) => void;
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export type PluginHooks = {
  "agent.task.before"?: (task: Task, ctx: PluginContext) => void | Promise<void>;
  "agent.task.after"?: (task: Task, result: TaskResult, ctx: PluginContext) => void | Promise<void>;
  "tool.execute.before"?: (input: ToolInput, ctx: PluginContext) => void | Promise<void>;
  "tool.execute.after"?: (
    output: ToolOutput,
    ctx: PluginContext,
  ) => ToolOutput | Promise<ToolOutput>;
  "memory.write"?: (entry: MemoryEntry, ctx: PluginContext) => MemoryEntry | Promise<MemoryEntry>;
  "memory.query"?: (query: MemoryQuery, ctx: PluginContext) => MemoryQuery | Promise<MemoryQuery>;
  "knowledge.query"?: (
    query: KnowledgeQuery,
    ctx: PluginContext,
  ) => KnowledgeQuery | Promise<KnowledgeQuery>;
  "knowledge.update"?: (
    paths: { docs?: string[]; code?: string[] },
    ctx: PluginContext,
  ) => void | Promise<void>;
  "session.start"?: (session: Session, ctx: PluginContext) => void | Promise<void>;
  "session.end"?: (session: Session, ctx: PluginContext) => void | Promise<void>;
  "llm.call.before"?: (call: LLMCall, ctx: PluginContext) => LLMCall | Promise<LLMCall>;
  "llm.call.after"?: (
    call: LLMCall,
    response: LLMResponse,
    ctx: PluginContext,
  ) => void | Promise<void>;
};

export type PluginHookName = keyof PluginHooks;

export interface OrqenixPlugin {
  name: string;
  version: string;
  description?: string;
  priority?: number;
  hooks: PluginHooks;
  capabilities?: string[];
  onRegister?: (ctx: PluginContext) => void | Promise<void>;
  onUnregister?: (ctx: PluginContext) => void | Promise<void>;
}
