// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Tool definitions
//
// 10 MCP tools exposing Orqenix memory + skills + mesh per CR v8.0 Section 9.2.1.
// Each tool has a name + description + inputSchema + handler.

import { z } from 'zod';
import type { MemoryEngine, KbKind } from '@orqenix/memory-engine';
import type { SkillRuntime } from '@orqenix/skill-runtime';

export interface ToolContext {
  engine: MemoryEngine;
  skillRuntime: SkillRuntime;
  /** Current session context for the connected client */
  sessionId?: string;
  branchId?: string;
  /** Client identifier (agent platform) */
  clientId: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, ctx: ToolContext) => Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────
// Tool 1: orqenix_recall_memory
// ─────────────────────────────────────────────────────────────────────────

const RecallMemoryArgs = z.object({
  query: z.string().min(1),
  kbs: z.array(z.enum(['chat', 'code', 'decision', 'lesson'])).optional(),
  limit: z.number().int().positive().max(100).default(20),
});

const recallMemoryTool: McpToolDefinition = {
  name: 'orqenix_recall_memory',
  description:
    'Query memory across the project/branch/session hierarchy. Returns ranked entries with provenance.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      kbs: {
        type: 'array',
        items: { enum: ['chat', 'code', 'decision', 'lesson'] },
        description: 'Optional KB filter',
      },
      limit: { type: 'number', default: 20 },
    },
    required: ['query'],
  },
  async handler(args, ctx) {
    const parsed = RecallMemoryArgs.parse(args);
    const result = await ctx.engine.query({
      query: parsed.query,
      ...(parsed.kbs ? { kbs: parsed.kbs } : {}),
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
      branchId: ctx.branchId ?? '',
      limit: parsed.limit,
    });
    return {
      results: result.results.map((r) => ({
        id: r.entry.id,
        kb: r.entry.kb,
        tier: r.entry.tier,
        content: r.entry.content,
        score: r.finalScore,
        sourceLevel: r.sourceLevel,
        isSubagentReturn: r.entry.protection_flags?.kind === 'subagent_return',
      })),
      levelsQueried: result.levelsQueried,
      durationMs: result.durationMs,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 2: orqenix_record_decision
// ─────────────────────────────────────────────────────────────────────────

const RecordDecisionArgs = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
  status: z.enum(['proposed', 'accepted', 'superseded']).default('accepted'),
});

const recordDecisionTool: McpToolDefinition = {
  name: 'orqenix_record_decision',
  description: 'Record an architectural decision with rationale and alternatives.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      rationale: { type: 'string' },
      alternatives: { type: 'array', items: { type: 'string' } },
      status: { enum: ['proposed', 'accepted', 'superseded'], default: 'accepted' },
    },
    required: ['title', 'rationale'],
  },
  async handler(args, ctx) {
    const parsed = RecordDecisionArgs.parse(args);
    const content = JSON.stringify({
      title: parsed.title,
      rationale: parsed.rationale,
      alternatives: parsed.alternatives ?? [],
      status: parsed.status,
    });
    const entry = await ctx.engine.write({
      kb: 'decision',
      content,
      branch_id: ctx.branchId ?? '',
      ...(ctx.sessionId ? { session_id: ctx.sessionId } : {}),
      memory_level: ctx.sessionId ? 'session' : 'branch',
    });
    return { entryId: entry.id, status: parsed.status };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 3: orqenix_record_lesson
// ─────────────────────────────────────────────────────────────────────────

const RecordLessonArgs = z.object({
  title: z.string().min(1),
  context: z.string().min(1),
  lesson: z.string().min(1),
  references: z.array(z.string()).optional(),
});

const recordLessonTool: McpToolDefinition = {
  name: 'orqenix_record_lesson',
  description: 'Record a lesson learned from debugging, incidents, or post-mortems.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      context: { type: 'string' },
      lesson: { type: 'string' },
      references: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'context', 'lesson'],
  },
  async handler(args, ctx) {
    const parsed = RecordLessonArgs.parse(args);
    const content = JSON.stringify({
      title: parsed.title,
      context: parsed.context,
      lesson: parsed.lesson,
      references: parsed.references ?? [],
    });
    const entry = await ctx.engine.write({
      kb: 'lesson',
      content,
      branch_id: ctx.branchId ?? '',
      ...(ctx.sessionId ? { session_id: ctx.sessionId } : {}),
      memory_level: ctx.sessionId ? 'session' : 'branch',
    });
    return { entryId: entry.id };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 4: orqenix_query_codekb
// ─────────────────────────────────────────────────────────────────────────

const QueryCodeKbArgs = z.object({
  codePattern: z.string().optional(),
  language: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
});

const queryCodeKbTool: McpToolDefinition = {
  name: 'orqenix_query_codekb',
  description: 'Query the CodeKB for code snippets, ASTs, and symbols.',
  inputSchema: {
    type: 'object',
    properties: {
      codePattern: { type: 'string' },
      language: { type: 'string' },
      limit: { type: 'number', default: 20 },
    },
  },
  async handler(args, ctx) {
    const parsed = QueryCodeKbArgs.parse(args);
    const result = await ctx.engine.query({
      query: parsed.codePattern ?? '',
      kbs: ['code'],
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
      branchId: ctx.branchId ?? '',
      limit: parsed.limit,
    });
    return {
      results: result.results.map((r) => ({
        id: r.entry.id,
        content: r.entry.content,
        score: r.finalScore,
      })),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 5: orqenix_invoke_skill
// ─────────────────────────────────────────────────────────────────────────

const InvokeSkillArgs = z.object({
  skillName: z.string().min(1),
  input: z.unknown(),
});

const invokeSkillTool: McpToolDefinition = {
  name: 'orqenix_invoke_skill',
  description: 'Invoke a registered Orqenix skill by name with input matching its schema.',
  inputSchema: {
    type: 'object',
    properties: {
      skillName: { type: 'string' },
      input: { type: 'object' },
    },
    required: ['skillName', 'input'],
  },
  async handler(args, ctx) {
    const parsed = InvokeSkillArgs.parse(args);
    const result = await ctx.skillRuntime.invoke(parsed.skillName, parsed.input, {
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
      clientId: ctx.clientId,
    });
    return result;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 6: orqenix_link_scope
// ─────────────────────────────────────────────────────────────────────────

const LinkScopeArgs = z.object({
  fromScopeId: z.string(),
  toScopeId: z.string(),
  capabilities: z.array(z.string()),
});

const linkScopeTool: McpToolDefinition = {
  name: 'orqenix_link_scope',
  description: 'Link two scopes with a capability transfer (directional).',
  inputSchema: {
    type: 'object',
    properties: {
      fromScopeId: { type: 'string' },
      toScopeId: { type: 'string' },
      capabilities: { type: 'array', items: { type: 'string' } },
    },
    required: ['fromScopeId', 'toScopeId', 'capabilities'],
  },
  async handler(args, _ctx) {
    const parsed = LinkScopeArgs.parse(args);
    // Link state is managed by @orqenix/link-state (extends Phase 6 capability tokens).
    // For D8.α.7 the MCP tool surface is defined; full link wiring composed at engine level.
    return {
      linked: true,
      from: parsed.fromScopeId,
      to: parsed.toScopeId,
      capabilities: parsed.capabilities,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 7: orqenix_verify_audit_chain
// ─────────────────────────────────────────────────────────────────────────

const verifyAuditChainTool: McpToolDefinition = {
  name: 'orqenix_verify_audit_chain',
  description: 'Verify the integrity of the project audit chain (BLAKE3).',
  inputSchema: { type: 'object', properties: {} },
  async handler(_args, ctx) {
    const result = ctx.engine.verifyAuditChain();
    return {
      valid: result.valid,
      entriesVerified: result.entriesVerified,
      firstMismatchSeq: result.firstMismatchSeq,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 8: orqenix_promote_to_branch
// ─────────────────────────────────────────────────────────────────────────

const PromoteToBranchArgs = z.object({
  entryId: z.string(),
  kb: z.enum(['chat', 'code', 'decision', 'lesson']),
  reason: z.string().optional(),
});

const promoteToBranchTool: McpToolDefinition = {
  name: 'orqenix_promote_to_branch',
  description: 'Promote a session-level memory entry to branch level.',
  inputSchema: {
    type: 'object',
    properties: {
      entryId: { type: 'string' },
      kb: { enum: ['chat', 'code', 'decision', 'lesson'] },
      reason: { type: 'string' },
    },
    required: ['entryId', 'kb'],
  },
  async handler(args, ctx) {
    const parsed = PromoteToBranchArgs.parse(args);
    await ctx.engine.promote({
      entryId: parsed.entryId,
      kb: parsed.kb as KbKind,
      from: 'session',
      to: 'branch',
      ...(ctx.sessionId ? { fromSessionId: ctx.sessionId } : {}),
      fromBranchId: ctx.branchId ?? '',
      ...(parsed.reason ? { reason: parsed.reason } : {}),
    });
    return { promoted: true };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tool 9 + 10: session lifecycle
// ─────────────────────────────────────────────────────────────────────────

const ReportSessionStartArgs = z.object({
  agentPlatform: z.string(),
  parentSessionId: z.string().optional(),
});

const reportSessionStartTool: McpToolDefinition = {
  name: 'orqenix_report_session_start',
  description: 'Report a new session to Orqenix (for self-learning + hierarchy).',
  inputSchema: {
    type: 'object',
    properties: {
      agentPlatform: { type: 'string' },
      parentSessionId: { type: 'string' },
    },
    required: ['agentPlatform'],
  },
  async handler(args, ctx) {
    const parsed = ReportSessionStartArgs.parse(args);
    // Session record managed by memory-engine sessions table; MCP surface defined here.
    const sessionId = ctx.sessionId ?? generateSessionId();
    return { sessionId, agentPlatform: parsed.agentPlatform };
  },
};

const reportSessionResumeTool: McpToolDefinition = {
  name: 'orqenix_report_session_resume',
  description: 'Report resumption of a previous session.',
  inputSchema: {
    type: 'object',
    properties: { sessionId: { type: 'string' } },
    required: ['sessionId'],
  },
  async handler(args, _ctx) {
    const parsed = z.object({ sessionId: z.string() }).parse(args);
    return { resumed: true, sessionId: parsed.sessionId };
  },
};

function generateSessionId(): string {
  return '01' + Math.random().toString(36).slice(2, 26).toUpperCase().padEnd(24, '0');
}

// ─────────────────────────────────────────────────────────────────────────
// Aggregate: all 10 tools
// ─────────────────────────────────────────────────────────────────────────

export const ALL_TOOLS: McpToolDefinition[] = [
  recallMemoryTool,
  recordDecisionTool,
  recordLessonTool,
  queryCodeKbTool,
  invokeSkillTool,
  linkScopeTool,
  verifyAuditChainTool,
  promoteToBranchTool,
  reportSessionStartTool,
  reportSessionResumeTool,
];

export function getToolByName(name: string): McpToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}
