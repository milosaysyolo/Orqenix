// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// DEMO STORE — in-memory replacement for the real memory engine + sqlite.
// Holds seed data and mutators that emit events on the bus, so the UI has
// realistic data to render and every write is observable live.
// ============================================================================

import { eventBus } from './event-bus';

export type KbKind = 'chat' | 'code' | 'decision' | 'lesson';
export type Tier = 'T1' | 'T2' | 'T3' | 'T4';
// Real hierarchy levels from @orqenix/memory-engine (session < branch < project)
export type MemoryLevel = 'session' | 'branch' | 'project';

export interface MemoryEntry {
  id: string;
  kb: KbKind;
  tier: Tier;
  content: string;
  branch_id: string;
  session_id: string;
  memory_level: MemoryLevel;
  created_at: string;
  pinned?: boolean;
}

export interface LibraryItem { entryId: string; kb: KbKind; content: string; }

export interface TeamNode { id: string; name: string; type: 'agent' | 'subagent' | 'service'; x: number; y: number; }
export interface TeamEdge { id: string; from: string; to: string; type: 'spawn' | 'tool' | 'comm' | 'data'; }

export interface Session {
  session_id: string;
  agent_name: string;
  state: 'running' | 'idle' | 'error' | 'completed' | 'paused';
  started_at: string;
  progress: number;
  subagents?: Session[];
  // Enriched to match real Orqenix session model
  agent_platform: string;            // "claude-code" | "cursor" | etc.
  parent_session_id?: string;        // for subagent sessions
  paused_at?: string;                // timestamp when paused
  promoted_entries?: number;         // entries promoted to branch level
}

export interface LearningCandidate { id: string; name: string; impact: number; successRate: number; count: number; status: 'pending' | 'approved' | 'rejected'; }

export interface Branch { branch_id: string; branch_name: string; created_at: string; cloned_from_branch_id: string | null; sessions: number; }
export interface MarketplaceItem { id: string; name: string; kind: string; description: string; author: string; publisher: string; version: string; downloads: number; rating: number; license: string; source: string; verified: boolean; installed: boolean; }
export interface Plugin { id: string; name: string; version: string; enabled: boolean; description: string; author: string; config?: string; }
export interface Skill { id: string; name: string; category: string; version: string; enabled: boolean; description: string; config?: string; }
export interface MeshPeer { id: string; name: string; address: string; transport: string; latency: number; connected: boolean; }
export interface AuditEntry { ts: string; hash: string; valid: boolean; action?: string; actor?: string; }
export interface ObservabilityMetric { label: string; value: string; unit: string; status: 'ok' | 'warn' | 'error'; }
export interface SubagentDef { id: string; name: string; role: string; status: 'idle' | 'running' | 'error'; uptime: string; tasksCompleted: number; config?: string; parentAgentId?: string; }

// ── Orqenix-aligned types ───────────────────────────────────────────────────
// Maps to AgentFile from @orqenix/core (OpenCodeFrontmatter + OrqenixAgentExtension)
export type ReindexAfter = 'auto' | 'code' | 'docs' | 'both' | 'none';
export interface AgentDefinition {
  id: string;
  name: string;
  mode: 'primary' | 'subagent' | 'all';
  role: string;
  isTeamLead: boolean;
  managesAgents: string[];
  // OpenCode frontmatter fields
  description: string;
  model: string;
  temperature: number;
  tools: Record<string, boolean>;
  maxSteps: number;
  // Orqenix extension fields
  costBudgetTokens: number;
  protectContext: boolean;
  // 11 fields added to fully match real AgentFile
  permission: Record<string, string>;          // per-op ask/allow/deny map
  prompt: string;                              // system prompt override
  disable: boolean;                            // agent disable toggle
  knowledge_briefing: boolean;                 // Chapter 12 knowledge workflow
  briefing_kbs: string[];                      // ["decisions","docs","code"]
  briefing_max_tokens: number;                 // briefing token budget
  capture_decisions: boolean;                  // auto-capture decisions
  reindex_after: ReindexAfter;                 // "auto"|"code"|"docs"|"both"|"none"
  writes: string[];                            // ["code","docs","tests","config"]
  lazyAgents: string[];                        // lazy-loaded agent names
  fallback_model: string;                      // fallback model when primary fails
  config: string;
}

// Maps to SubagentConstraints from @orqenix/memory-engine
export interface SubagentConstraints {
  maxSteps: number;       // default 5
  maxWallTimeSec: number; // default 90
  allowedTools: string[];
  forbiddenTools: string[]; // default ["write_file", "git_commit"]
}

// Maps to SubagentHarness from @orqenix/memory-engine
export interface SubagentHarnessData {
  subagentKind: string;
  systemPrompt: string;
  goal: string;
  scopedContext: {
    entryIds: string[];
    rationale: string;
  };
  constraints: SubagentConstraints;
  returnSchema: Record<string, unknown>;
}
export interface SandboxPlugin {
  name: string;
  kind: string;
  state: 'active' | 'inactive' | 'crashed';
  entryPoint: string;
  crashCount: number;
}
// Maps to SubagentInvocation + SubagentReturn + AbsorbResult from @orqenix/memory-engine
export interface SubagentInvocationRecord {
  id: string;
  subagentId: string;
  subagentKind: string;
  parentSessionId: string;
  invokedAt: string;
  status: 'success' | 'timeout' | 'error';
  wallTimeMs: number;
  stepsTaken: number;
  // Legacy fields (kept for backward compat)
  t1EntryId?: string;
  t2EntryId?: string;
  // Maps to SubagentReturn
  returnData: {
    output: unknown;
    outputMatchesSchema: boolean;
  };
  // Maps to AbsorbResult from return-absorber.ts
  absorbResult?: {
    t1EntryId: string;
    t2EntryId: string;
  };
}
export interface MCPDefinition { id: string; name: string; transport: 'stdio' | 'sse'; enabled: boolean; tools: number; resources: number; }
export type BindingPlatform = 'claude-code' | 'cursor' | 'cline' | 'codex' | 'continue' | 'aider' | 'opencode';
export interface BindingDefinition { platform: BindingPlatform; state: 'not_installed' | 'active'; configPath?: string; }

export interface GraphNode { id: string; label: string; type: 'project' | 'kb' | 'branch' | 'entry'; kb?: KbKind; tier?: Tier; count?: number; }
export interface GraphEdge { from: string; to: string; type: 'linked' | 'cloned' | 'promoted' | 'contains'; label?: string; }

// Maps to SyncEngine.syncTeam() result from @orqenix/core
export type SyncMode = 'sync' | 'dry-run' | 'verify';
export interface SyncConflict {
  agent: string;
  sourceHash: string;
  outputHash: string;
  resolution: string; // "orqenix-wins" | "opencode-wins" | "prompt"
}
export interface SyncResult {
  timestamp: string;
  teamId: string;
  mode: SyncMode;
  written: string[];
  skipped: string[];
  drift: { agent: string; description: string }[];
  conflicts: SyncConflict[];
  status: 'success' | 'conflicts' | 'drift-detected';
}

interface Store {
  projectId: string;
  entries: MemoryEntry[];
  library: LibraryItem[];
  links: Array<{ from: string; to: string }>;
  team: { nodes: TeamNode[]; edges: TeamEdge[] };
  sessions: Session[];
  candidates: LearningCandidate[];
  audit: AuditEntry[];
  matrix: Record<string, Record<string, number>>;
  branches: Branch[];
  marketplace: MarketplaceItem[];
  installedItems: string[];  // names of installed marketplace items
  plugins: Plugin[];
  skills: Skill[];
  meshPeers: MeshPeer[];
  observability: ObservabilityMetric[];
  subagents: SubagentDef[];
  subagentHarnesses: SubagentHarnessData[];
  subagentInvocations: SubagentInvocationRecord[];
  sandboxPlugins: SandboxPlugin[];
  mcpServers: MCPDefinition[];
  mcpTokens: Array<{ id: string; client: string; scopes_json: string; expires_at: string }>;
  agentConfigs: Record<string, string>;
  agentDefinitions: AgentDefinition[];
  syncResults: SyncResult[];
  bindings: BindingDefinition[];
  settings: { theme: string; memoryTier: string; searchAlgorithm: string; autoLearn: boolean; cloudSync: boolean; };
  settingsOverrides: Record<string, Record<string, unknown>>;
  observerEnabled: boolean;
}

const KB_LABEL: Record<KbKind, string> = { chat: 'Chat', code: 'Code', decision: 'Decisions', lesson: 'Lessons' };

function seed(): Store {
  const now = Date.now();
  const brMain = 'blake3:main0000000000aabb';
  const brFeat = 'blake3:feat_auth_7b1e4f2';
  const brFix = 'blake3:fix_meter_d3c0a91';
  // memory_level follows the real hierarchy: session | branch | project
  const mk = (i: number, kb: KbKind, tier: Tier, level: MemoryLevel, branchId: string, content: string, mins: number): MemoryEntry => ({
    id: `${kb}_${1000 + i}`, kb, tier, content, branch_id: branchId,
    session_id: `sess_${500 + (i % 6)}`, memory_level: level,
    created_at: new Date(now - mins * 60000).toISOString(),
  });

  const entries: MemoryEntry[] = [
    mk(1, 'decision', 'T1', 'session', brMain, 'JWT refresh tokens are rotated on use; old tokens are revoked via a denylist with 60s TTL.', 42),
    mk(2, 'code', 'T2', 'branch', brMain, 'auth/refresh.ts: refresh() validates the lineage chain before minting a new pair.', 38),
    mk(3, 'chat', 'T3', 'session', brFeat, 'User asked how rotation handles concurrent requests — answered: atomic compare-and-swap on token version.', 31),
    mk(4, 'lesson', 'T2', 'branch', brFeat, 'Refresh-token reuse detection must be idempotent to survive retries.', 27),
    mk(5, 'decision', 'T1', 'project', brMain, 'Billing moved to usage-based metering with a monthly true-up job.', 96),
    mk(6, 'code', 'T3', 'branch', brFix, 'billing/meter.ts: emit() writes to the events ring before the ledger call.', 90),
    mk(7, 'chat', 'T4', 'session', brFix, 'Discussion of webhook retry budgets for the billing provider.', 84),
    mk(8, 'lesson', 'T1', 'project', brMain, 'Capability tokens must encode an expiry and be verified on every hop.', 12),
    mk(9, 'code', 'T2', 'branch', brMain, 'middleware/cap.ts: verify() short-circuits on a revoked-token bloom filter hit.', 10),
    mk(10, 'decision', 'T3', 'session', brFeat, 'Self-learning candidates require a verification loop before promotion.', 5),
  ];

  const library: LibraryItem[] = [
    { entryId: 'decision_1001', kb: 'decision', content: 'JWT refresh tokens are rotated on use…' },
    { entryId: 'lesson_1008', kb: 'lesson', content: 'Capability tokens must encode an expiry…' },
  ];

  const team = {
    nodes: [
      { id: 'lead', name: 'lead', type: 'agent', x: 240, y: 180 },
      { id: 'architect', name: 'architect', type: 'agent', x: 240, y: 40 },
      { id: 'devops', name: 'devops', type: 'agent', x: 240, y: 340 },
      { id: 'researcher', name: 'researcher', type: 'subagent', x: 470, y: 110 },
      { id: 'coder', name: 'coder', type: 'subagent', x: 500, y: 250 },
      { id: 'tester', name: 'tester', type: 'subagent', x: 460, y: 380 },
      { id: 'kb', name: 'memory', type: 'service', x: 100, y: 260 },
      { id: 'planner', name: 'planner', type: 'subagent', x: 390, y: 20 },
      { id: 'debugger', name: 'debugger', type: 'subagent', x: 640, y: 180 },
      { id: 'security', name: 'security-auditor', type: 'subagent', x: 630, y: 340 },
      { id: 'reviewer', name: 'reviewer', type: 'subagent', x: 650, y: 60 },
      { id: 'docs', name: 'docs-writer', type: 'subagent', x: 470, y: 460 },
    ] as TeamNode[],
    edges: [
      { id: 'e1', from: 'lead', to: 'researcher', type: 'spawn' },
      { id: 'e2', from: 'lead', to: 'coder', type: 'spawn' },
      { id: 'e3', from: 'lead', to: 'tester', type: 'comm' },
      { id: 'e4', from: 'lead', to: 'kb', type: 'data' },
      { id: 'e5', from: 'researcher', to: 'kb', type: 'tool' },
      { id: 'e6', from: 'lead', to: 'planner', type: 'spawn' },
      { id: 'e7', from: 'lead', to: 'debugger', type: 'spawn' },
      { id: 'e8', from: 'lead', to: 'security', type: 'spawn' },
      { id: 'e9', from: 'researcher', to: 'debugger', type: 'comm' },
      { id: 'e10', from: 'coder', to: 'security', type: 'tool' },
      { id: 'e11', from: 'architect', to: 'lead', type: 'spawn' },
      { id: 'e12', from: 'architect', to: 'planner', type: 'comm' },
      { id: 'e13', from: 'architect', to: 'reviewer', type: 'spawn' },
      { id: 'e14', from: 'devops', to: 'lead', type: 'comm' },
      { id: 'e15', from: 'devops', to: 'coder', type: 'spawn' },
      { id: 'e16', from: 'devops', to: 'docs', type: 'spawn' },
      { id: 'e17', from: 'coder', to: 'reviewer', type: 'comm' },
      { id: 'e18', from: 'tester', to: 'debugger', type: 'data' },
    ] as TeamEdge[],
  };

  const sessions: Session[] = [
    {
      session_id: 'sess_501', agent_name: 'claude-code', state: 'running', started_at: new Date(now - 180000).toISOString(), progress: 0.6,
      agent_platform: 'claude-code', parent_session_id: undefined, paused_at: undefined, promoted_entries: 3,
      subagents: [
        { session_id: 'sub_researcher', agent_name: 'researcher', state: 'running', started_at: new Date(now - 120000).toISOString(), progress: 0.4, agent_platform: 'claude-code', parent_session_id: 'sess_501', paused_at: undefined, promoted_entries: 0 },
        { session_id: 'sub_coder', agent_name: 'coder', state: 'idle', started_at: new Date(now - 90000).toISOString(), progress: 0, agent_platform: 'claude-code', parent_session_id: 'sess_501', paused_at: undefined, promoted_entries: 0 },
      ],
    },
    { session_id: 'sess_502', agent_name: 'codex', state: 'paused', started_at: new Date(now - 600000).toISOString(), progress: 0.3, agent_platform: 'codex', parent_session_id: undefined, paused_at: new Date(now - 120000).toISOString(), promoted_entries: 1 },
    { session_id: 'sess_503', agent_name: 'cline', state: 'completed', started_at: new Date(now - 3600000).toISOString(), progress: 1, agent_platform: 'cline', parent_session_id: undefined, paused_at: undefined, promoted_entries: 5 },
  ];

  const candidates: LearningCandidate[] = [
    { id: 'c1', name: 'refresh-rotation-guard', impact: 0.82, successRate: 0.94, count: 17, status: 'pending' },
    { id: 'c2', name: 'cap-token-bloom-check', impact: 0.71, successRate: 0.88, count: 9, status: 'pending' },
    { id: 'c3', name: 'meter-before-ledger', impact: 0.64, successRate: 0.79, count: 12, status: 'approved' },
  ];

  const audit = [
    { ts: new Date(now - 1000).toISOString(), hash: '0x9af1', valid: true },
    { ts: new Date(now - 40000).toISOString(), hash: '0x7c3e', valid: true },
  ];

  const matrix: Record<string, Record<string, number>> = { T1: {}, T2: {}, T3: {}, T4: {} };
  for (const e of entries) {
    const row = matrix[e.tier];
    if (!row) continue;
    row[e.kb] = (row[e.kb] ?? 0) + 1;
  }

  const branches: Branch[] = [
    { branch_id: 'blake3:main0000000000aabb', branch_name: 'main', created_at: new Date(now - 86400000 * 30).toISOString(), cloned_from_branch_id: null, sessions: 24 },
    { branch_id: 'blake3:feat_auth_7b1e4f2', branch_name: 'feature/token-rotation', created_at: new Date(now - 86400000 * 5).toISOString(), cloned_from_branch_id: 'blake3:main0000000000aabb', sessions: 7 },
    { branch_id: 'blake3:fix_meter_d3c0a91', branch_name: 'fix/meter-race', created_at: new Date(now - 86400000 * 2).toISOString(), cloned_from_branch_id: 'blake3:main0000000000aabb', sessions: 3 },
    { branch_id: 'blake3:exp_bloom_9e4f2b7', branch_name: 'exp/bloom-filter', created_at: new Date(now - 86400000).toISOString(), cloned_from_branch_id: 'blake3:feat_auth_7b1e4f2', sessions: 1 },
  ];

  const marketplace: MarketplaceItem[] = [
    { id: 'mp_1', name: 'context-bridge', kind: 'agent-binding', description: 'Bidirectional context sync between Orqenix instances', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '2.1.0', downloads: 14200, rating: 4.7, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: true },
    { id: 'mp_2', name: 'code-review-agent', kind: 'agent', description: 'Automated PR review with knowledge-aware suggestions', author: 'community', publisher: 'Community', version: '1.4.2', downloads: 8300, rating: 4.3, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_3', name: 'prompt-studio', kind: 'skill', description: 'Visual prompt chain builder with A/B testing', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.9.0', downloads: 5600, rating: 4.5, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_4', name: 'memory-weather', kind: 'skill', description: 'Memory hygiene reports and consolidation suggestions', author: 'community', publisher: 'Community', version: '1.0.0', downloads: 2100, rating: 3.8, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_5', name: 'ollama-embedder', kind: 'embedding-model', description: 'Local embeddings via Ollama (default Qwen 2.5 7B)', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 3400, rating: 4.2, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: true },
    { id: 'mp_6', name: 'smart-compress', kind: 'compression-strategy', description: 'Tier-preserving context compression with overflow handling', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 2800, rating: 4.6, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: true },
    { id: 'mp_7', name: 'hierarchy-injector', kind: 'memory-injection-strategy', description: 'Five injection strategies (A-E) per CR v7.1 Ch.8', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 1900, rating: 4.4, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_8', name: 'knowledge-workflow', kind: 'knowledge-source', description: 'Pre-task briefing + post-task reindex knowledge workflow', author: 'community', publisher: 'Community', version: '0.5.0', downloads: 1200, rating: 4.0, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_9', name: 'tree-sitter-code', kind: 'kb-schema', description: 'Tree-sitter code KB supporting 20 programming languages', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 4500, rating: 4.8, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: true },
    { id: 'mp_10', name: 'grafana-viz', kind: 'visualization', description: 'Memory matrix and knowledge graph dashboards for Grafana', author: 'community', publisher: 'Community', version: '1.0.0', downloads: 980, rating: 3.5, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_11', name: 'cost-tracker', kind: 'mcp-server', description: 'Token usage and cost tracking per agent/scope/session', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 3200, rating: 4.1, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_12', name: 'semantic-cache', kind: 'prompt-rewriter', description: 'Exact-match LLM call cache with semantic dedup', author: 'community', publisher: 'Community', version: '0.5.0', downloads: 1500, rating: 3.9, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_13', name: 'code-analyzer', kind: 'code-analyzer', description: 'Static analysis and symbol extraction across KBs', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.5.0', downloads: 2600, rating: 4.3, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_14', name: 'reranker-local', kind: 'reranker', description: 'Local cross-encoder reranker for KB query results', author: 'community', publisher: 'Community', version: '0.5.0', downloads: 800, rating: 3.7, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_15', name: 'orqenix-search', kind: 'skill', description: 'Hybrid search combining BM25 + vector embeddings with reranking', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '1.2.0', downloads: 6700, rating: 4.6, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_16', name: 'neo4j-memory', kind: 'kb-schema', description: 'Neo4j-backed knowledge graph schema with Cypher query support', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.9.0', downloads: 4100, rating: 4.4, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_17', name: 'webhook-gateway', kind: 'agent-binding', description: 'Bidirectional webhook bridge for external event triggering', author: 'community', publisher: 'Community', version: '1.1.0', downloads: 2300, rating: 4.0, license: 'MIT', source: 'community', verified: false, installed: false },
    { id: 'mp_18', name: 'diff-checker', kind: 'code-analyzer', description: 'Semantic diff analysis with symbol-level change tracking', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.7.0', downloads: 1800, rating: 4.2, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_19', name: 'prompt-guard', kind: 'prompt-rewriter', description: 'Prompt injection detection and sanitization for agent inputs', author: 'orqenix-labs', publisher: 'Orqenix Inc.', version: '0.6.0', downloads: 5200, rating: 4.8, license: 'Apache-2.0', source: 'orqenix-registry', verified: true, installed: false },
    { id: 'mp_20', name: 'config-validator', kind: 'mcp-server', description: 'Validate and lint MCP configuration files against the schema', author: 'community', publisher: 'Community', version: '0.4.0', downloads: 950, rating: 3.9, license: 'MIT', source: 'community', verified: false, installed: false },
  ];

  const plugins: Plugin[] = [
    { id: 'pl_1', name: 'context-bridge', version: '1.3.2', enabled: true, description: 'Bidirectional context sync between Orqenix instances', author: 'orqenix-labs', config: '{"syncMode":"bidirectional","conflictResolution":"latest-wins","maxBatchSize":100}' },
    { id: 'pl_2', name: 'ollama-embedder', version: '0.8.1', enabled: true, description: 'Local embeddings via Ollama (default Qwen 2.5 7B)', author: 'community', config: '{"model":"qwen2.5:7b","dimensions":384,"batchSize":32,"timeout":30000}' },
    { id: 'pl_3', name: 'smart-compress', version: '1.1.0', enabled: true, description: 'Tier-preserving context compression with overflow handling', author: 'orqenix-labs', config: '{"strategy":"tier-preserving","maxRatio":0.4,"preserveTiers":["T1","T2"]}' },
    { id: 'pl_4', name: 'tree-sitter-code', version: '2.0.3', enabled: true, description: 'Tree-sitter code KB supporting 20 programming languages', author: 'orqenix-labs', config: '{"languages":["typescript","python","rust","go"],"extractSymbols":true,"maxFileSize":1048576}' },
    { id: 'pl_5', name: 'neo4j-memory', version: '1.0.0', enabled: false, description: 'Neo4j-backed knowledge graph schema with Cypher query support', author: 'community', config: '{"uri":"bolt://localhost:7687","database":"orqenix","maxConnections":10}' },
    { id: 'pl_6', name: 'webhook-gateway', version: '0.5.2', enabled: true, description: 'Bidirectional webhook bridge for external event triggering', author: 'orqenix-labs', config: '{"endpoints":[],"retryPolicy":"exponential","maxRetries":3}' },
    { id: 'pl_7', name: 'diff-checker', version: '0.7.0', enabled: true, description: 'Semantic diff with symbol-level change tracking', author: 'orqenix-labs', config: '{"ignoreWhitespace":true,"detectRenames":true,"contextLines":3}' },
    { id: 'pl_8', name: 'config-validator', version: '0.4.0', enabled: false, description: 'Validate MCP configuration files against schema', author: 'community', config: '{"schemaVersion":"1.0","strictMode":false,"customRules":[]}' },
  ];

  const skills: Skill[] = [
    { id: 'sk_1', name: 'code-review', category: 'development', version: '1.2.0', enabled: true, description: 'Review code changes against memory patterns', config: '# Code Review Skill\n\n## Description\nReview code changes against memory patterns and best practices.\n\n## Parameters\n- diff: string (required)\n- context: string (optional)\n\n## Output\n- issues: array of findings\n- severity: overall severity level\n- summary: brief summary' },
    { id: 'sk_2', name: 'prompt-optimizer', category: 'prompting', version: '0.5.0', enabled: true, description: 'Optimize prompts using past feedback', config: '# Prompt Optimizer Skill\n\n## Description\nOptimize prompts based on historical feedback and success rates.\n\n## Parameters\n- prompt: string (required)\n- targetModel: string (optional)\n\n## Output\n- optimized: optimized prompt string\n- improvements: list of changes made' },
    { id: 'sk_3', name: 'dependency-audit', category: 'security', version: '1.0.0', enabled: false, description: 'Audit dependency trees for known vulnerabilities', config: '# Dependency Audit Skill\n\n## Description\nScan dependency trees for known vulnerabilities and outdated packages.\n\n## Parameters\n- path: string (default: ".")\n- deep: boolean (default: true)\n\n## Output\n- vulnerabilities: array\n- outdated: array\n- score: security score 0-100' },
    { id: 'sk_4', name: 'docs-generator', category: 'documentation', version: '2.2.1', enabled: true, description: 'Generate documentation from code and memory', config: '# Docs Generator Skill\n\n## Description\nGenerate comprehensive documentation from code analysis and memory entries.\n\n## Parameters\n- source: string (required)\n- format: "markdown" | "html" (default: "markdown")\n\n## Output\n- content: generated documentation\n- sections: array of section titles' },
    { id: 'sk_5', name: 'context-optimizer', category: 'performance', version: '1.1.0', enabled: true, description: 'Optimize context window usage with selective memory injection', config: '# Context Optimizer Skill\n\n## Description\nOptimize context window by selecting most relevant memory entries.\n\n## Parameters\n- query: string (required)\n- maxTokens: number (default: 4096)\n- tiers: array (default: ["T1","T2"])\n\n## Output\n- selected: array of memory entries\n- tokenCount: total tokens used' },
    { id: 'sk_6', name: 'semantic-search', category: 'search', version: '0.9.0', enabled: false, description: 'Cross-KB semantic search with hybrid ranking', config: '# Semantic Search Skill\n\n## Description\nSearch across all knowledge bases using hybrid BM25 + vector ranking.\n\n## Parameters\n- query: string (required)\n- topK: number (default: 10)\n- minScore: number (default: 0.5)\n\n## Output\n- results: ranked array of matches\n- scores: relevance scores' },
    { id: 'sk_7', name: 'template-generator', category: 'documentation', version: '1.0.0', enabled: true, description: 'Generate code templates from memory patterns', config: '# Template Generator Skill\n\n## Description\nGenerate code templates based on memory patterns and project conventions.\n\n## Parameters\n- type: string (required)\n- language: string (default: "typescript")\n\n## Output\n- template: generated code template\n- variables: list of template variables' },
    { id: 'sk_8', name: 'security-scanner', category: 'security', version: '0.8.0', enabled: false, description: 'Scan code and dependencies for known vulnerabilities', config: '# Security Scanner Skill\n\n## Description\nScan code and dependencies for known security vulnerabilities.\n\n## Parameters\n- path: string (default: ".")\n- severity: "low" | "medium" | "high" | "critical"\n\n## Output\n- findings: array of vulnerabilities\n- score: security score 0-100' },
  ];

  const meshPeers: MeshPeer[] = [
    { id: 'peer_1', name: 'orqenix-prod', address: '10.0.1.42:8921', transport: 'tcp', latency: 3, connected: true },
    { id: 'peer_2', name: 'orqenix-staging', address: '10.0.2.17:8921', transport: 'tcp', latency: 7, connected: true },
    { id: 'peer_3', name: 'dev-workstation-4', address: '192.168.1.84:8921', transport: 'tcp', latency: 1, connected: false },
  ];

  const observability: ObservabilityMetric[] = [
    { label: 'Context Assembly', value: '12.4', unit: 'ms avg', status: 'ok' },
    { label: 'Event Throughput', value: '347', unit: 'events/s', status: 'ok' },
    { label: 'Memory Query P99', value: '89', unit: 'ms', status: 'ok' },
    { label: 'SSE Connections', value: '3', unit: 'active', status: 'ok' },
    { label: 'Token Usage', value: '78.2', unit: '%', status: 'warn' },
    { label: 'Error Rate', value: '0.4', unit: '%', status: 'ok' },
    { label: 'Mesh Latency Avg', value: '4.2', unit: 'ms', status: 'ok' },
    { label: 'Queue Depth', value: '18', unit: 'messages', status: 'warn' },
  ];

  const subagents: SubagentDef[] = [
    { id: 'sa_researcher', name: 'researcher', role: 'information gathering', status: 'running', uptime: '2h 14m', tasksCompleted: 47, parentAgentId: 'lead', config: `# Researcher\n\nagent type: sub agent\n\n## System Prompt\nYou are a research agent. Gather information from knowledge bases and external sources.\n\n## Goal\nResearch the given topic and produce a structured summary.\n\n## Constraints\n- Max steps: 10\n- Max wall time: 180s\n- Allowed: read_memory, web_search, search_code` },
    { id: 'sa_coder', name: 'coder', role: 'code generation & refactoring', status: 'idle', uptime: '1h 38m', tasksCompleted: 23, parentAgentId: 'devops', config: `# Coder\n\nagent type: sub agent\n\n## System Prompt\nYou are a code generation agent. Write clean, well-documented code.\n\n## Goal\nImplement features with proper error handling and tests.\n\n## Constraints\n- Max steps: 15\n- Max wall time: 240s\n- Allowed: read_file, write_file, execute_command, search_code` },
    { id: 'sa_tester', name: 'tester', role: 'test writing & execution', status: 'idle', uptime: '45m', tasksCompleted: 12, parentAgentId: 'lead', config: `# Tester\n\nagent type: sub agent\n\n## System Prompt\nYou are a test runner agent. Execute test suites and report failures.\n\n## Goal\nRun the full test suite and report results with coverage.\n\n## Constraints\n- Max steps: 5\n- Max wall time: 90s\n- Allowed: read_file, execute_command` },
    { id: 'sa_reviewer', name: 'reviewer', role: 'code review & quality gate', status: 'running', uptime: '3h 02m', tasksCompleted: 58, parentAgentId: 'architect', config: `# Reviewer\n\nagent type: sub agent\n\n## System Prompt\nYou are a code reviewer. Review code changes against memory patterns.\n\n## Goal\nReview the latest diff and identify potential issues.\n\n## Constraints\n- Max steps: 8\n- Max wall time: 120s\n- Allowed: read_file, search_code, read_memory` },
    { id: 'sa_docs', name: 'docs-writer', role: 'documentation generation', status: 'error', uptime: '12m', tasksCompleted: 3, parentAgentId: 'devops', config: `# Docs Writer\n\nagent type: sub agent\n\n## System Prompt\nYou are a documentation generator. Create clear, comprehensive docs.\n\n## Goal\nGenerate documentation from code and memory entries.\n\n## Constraints\n- Max steps: 10\n- Max wall time: 180s\n- Allowed: read_file, read_memory, search_code` },
    { id: 'sa_planner', name: 'planner', role: 'task planning & decomposition', status: 'idle', uptime: '1h 05m', tasksCompleted: 19, parentAgentId: 'architect', config: `# Planner\n\nagent type: sub agent\n\n## System Prompt\nYou are a planning agent. Decompose complex tasks into steps.\n\n## Goal\nProduce a structured plan with milestones.\n\n## Constraints\n- Max steps: 6\n- Max wall time: 60s\n- Allowed: read_memory, search_code` },
    { id: 'sa_debugger', name: 'debugger', role: 'bug diagnosis & root cause analysis', status: 'running', uptime: '52m', tasksCompleted: 31, parentAgentId: 'lead', config: `# Debugger\n\nagent type: sub agent\n\n## System Prompt\nYou are a debugger agent. Isolate bugs and propose fixes.\n\n## Goal\nIdentify root cause and provide a reproducible fix.\n\n## Constraints\n- Max steps: 10\n- Max wall time: 150s\n- Allowed: read_file, execute_command, search_code, read_memory` },
    { id: 'sa_security', name: 'security-auditor', role: 'security review & vulnerability assessment', status: 'idle', uptime: '28m', tasksCompleted: 8, parentAgentId: 'lead', config: `# Security Auditor\n\nagent type: sub agent\n\n## System Prompt\nYou are a security auditor. Review code for vulnerabilities.\n\n## Goal\nPerform security audit and report findings.\n\n## Constraints\n- Max steps: 8\n- Max wall time: 120s\n- Allowed: read_file, search_code, read_memory` },
  ];

  const subagentHarnesses: SubagentHarnessData[] = [
    {
      subagentKind: 'lead',
      systemPrompt: 'You are the lead orchestrating agent. Delegate tasks to subagents based on their specialties. Review outputs and coordinate the team.',
      goal: 'Coordinate the team to deliver high-quality code with proper testing and documentation',
      scopedContext: { entryIds: ['decision_1001', 'lesson_1008'], rationale: 'Core architectural decisions and capability token patterns' },
      constraints: { maxSteps: 20, maxWallTimeSec: 600, allowedTools: ['read_memory', 'search_code', 'spawn_subagent'], forbiddenTools: ['write_file', 'execute_command'] },
      returnSchema: { status: 'string', summary: 'string' },
    },
    {
      subagentKind: 'architect',
      systemPrompt: 'You are the system architect. Design system architecture, define interfaces, review technical decisions, and ensure architectural consistency.',
      goal: 'Design scalable, maintainable architecture and ensure all components follow established patterns',
      scopedContext: { entryIds: ['decision_1001', 'code_1002'], rationale: 'JWT architecture and auth module patterns' },
      constraints: { maxSteps: 12, maxWallTimeSec: 240, allowedTools: ['read_memory', 'search_code', 'read_file'], forbiddenTools: ['write_file', 'execute_command', 'git_commit'] },
      returnSchema: { architecture: 'object', decisions: 'array', risks: 'array' },
    },
    {
      subagentKind: 'devops',
      systemPrompt: 'You are the DevOps agent. Manage CI/CD pipelines, infrastructure configuration, deployment workflows, and monitoring setup.',
      goal: 'Ensure reliable, automated deployment pipelines and maintain infrastructure health',
      scopedContext: { entryIds: ['decision_1005'], rationale: 'Billing metering architecture for deployment context' },
      constraints: { maxSteps: 15, maxWallTimeSec: 600, allowedTools: ['read_file', 'execute_command', 'search_code'], forbiddenTools: ['git_commit'] },
      returnSchema: { pipeline: 'string', status: 'string', environments: 'array' },
    },
    {
      subagentKind: 'researcher',
      systemPrompt: 'You are a research agent. Gather information from knowledge bases and external sources. Synthesize findings into structured summaries.',
      goal: 'Research the given topic and produce a structured summary with sources and confidence scores',
      scopedContext: { entryIds: ['decision_1001', 'chat_1003'], rationale: 'Auth decisions and user discussion context' },
      constraints: { maxSteps: 10, maxWallTimeSec: 180, allowedTools: ['read_memory', 'web_search', 'search_code'], forbiddenTools: ['write_file', 'execute_command', 'git_commit'] },
      returnSchema: { findings: 'array', sources: 'array', summary: 'string', confidence: 'number' },
    },
    {
      subagentKind: 'coder',
      systemPrompt: 'You are a code generation agent. Write clean, well-documented code following project conventions.',
      goal: 'Implement the requested features with proper error handling and tests',
      scopedContext: { entryIds: ['code_1002', 'lesson_1004'], rationale: 'Auth module patterns and refresh token lessons' },
      constraints: { maxSteps: 15, maxWallTimeSec: 240, allowedTools: ['read_file', 'write_file', 'execute_command', 'search_code'], forbiddenTools: ['git_commit'] },
      returnSchema: { filesChanged: 'array', summary: 'string', testsAdded: 'number' },
    },
    {
      subagentKind: 'tester',
      systemPrompt: 'You are a test runner agent. Execute test suites, report failures, and suggest fixes. Do not modify source files.',
      goal: 'Run the full test suite and report results with coverage metrics',
      scopedContext: { entryIds: ['code_1002'], rationale: 'Auth module test patterns' },
      constraints: { maxSteps: 5, maxWallTimeSec: 90, allowedTools: ['read_file', 'execute_command'], forbiddenTools: ['write_file', 'git_commit'] },
      returnSchema: { testCount: 'number', passed: 'number', failed: 'number', coverage: 'number', durationMs: 'number' },
    },
    {
      subagentKind: 'reviewer',
      systemPrompt: 'You are a code reviewer. Review code changes against memory patterns and best practices. Provide actionable feedback.',
      goal: 'Review the latest diff and identify potential issues against known patterns',
      scopedContext: { entryIds: ['decision_1001', 'lesson_1004', 'code_1002'], rationale: 'Architecture decisions, known patterns, and code context' },
      constraints: { maxSteps: 8, maxWallTimeSec: 120, allowedTools: ['read_file', 'search_code', 'read_memory'], forbiddenTools: ['write_file', 'execute_command'] },
      returnSchema: { issues: 'array', severity: 'string', summary: 'string', recommendations: 'array' },
    },
    {
      subagentKind: 'docs-writer',
      systemPrompt: 'You are a documentation generator. Create clear, comprehensive documentation from code and memory entries.',
      goal: 'Generate documentation that is accurate, well-structured, and useful for developers',
      scopedContext: { entryIds: ['decision_1001', 'code_1002'], rationale: 'Architecture and code for documentation generation' },
      constraints: { maxSteps: 10, maxWallTimeSec: 180, allowedTools: ['read_file', 'read_memory', 'search_code'], forbiddenTools: ['write_file', 'execute_command', 'git_commit'] },
      returnSchema: { content: 'string', sections: 'array', wordCount: 'number' },
    },
    {
      subagentKind: 'planner',
      systemPrompt: 'You are a planning agent. Decompose complex tasks into manageable steps, identify dependencies, and estimate effort.',
      goal: 'Analyze the given task and produce a structured plan with milestones and resource allocations',
      scopedContext: { entryIds: ['decision_1005', 'decision_1010'], rationale: 'Billing and learning system context for planning' },
      constraints: { maxSteps: 6, maxWallTimeSec: 60, allowedTools: ['read_memory', 'search_code'], forbiddenTools: ['write_file', 'execute_command'] },
      returnSchema: { steps: 'array', dependencies: 'array', estimatedHours: 'number', riskLevel: 'string' },
    },
    {
      subagentKind: 'debugger',
      systemPrompt: 'You are a debugger agent. Methodically isolate bugs, examine logs and stack traces, and propose verified fixes.',
      goal: 'Identify the root cause of the reported issue and provide a reproducible fix',
      scopedContext: { entryIds: ['code_1002', 'code_1006', 'lesson_1004'], rationale: 'Auth and billing code with known patterns' },
      constraints: { maxSteps: 10, maxWallTimeSec: 150, allowedTools: ['read_file', 'execute_command', 'search_code', 'read_memory'], forbiddenTools: ['write_file', 'git_commit'] },
      returnSchema: { rootCause: 'string', severity: 'string', fix: 'string', testCases: 'array' },
    },
    {
      subagentKind: 'security-auditor',
      systemPrompt: 'You are a security auditor. Review code for vulnerabilities, check dependency trees, and enforce security policies.',
      goal: 'Perform a security audit and report findings with severity levels and remediation steps',
      scopedContext: { entryIds: ['code_1002', 'lesson_1008'], rationale: 'Auth code and capability token patterns for security review' },
      constraints: { maxSteps: 8, maxWallTimeSec: 120, allowedTools: ['read_file', 'search_code', 'read_memory'], forbiddenTools: ['write_file', 'execute_command', 'git_commit'] },
      returnSchema: { findings: 'array', severity: 'string', summary: 'string', recommendations: 'array' },
    },
  ];

  const subagentInvocations: SubagentInvocationRecord[] = [
    { id: 'inv_001', subagentId: 'sa_tester', subagentKind: 'tester', parentSessionId: 'sess_501', invokedAt: new Date(now - 7200000).toISOString(), status: 'success', wallTimeMs: 45200, stepsTaken: 4, t1EntryId: 't1_001', t2EntryId: 't2_001', returnData: { output: { testCount: 142, passed: 138, failed: 4, coverage: 87.3, durationMs: 42100 }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_001', t2EntryId: 't2_001' } },
    { id: 'inv_002', subagentId: 'sa_researcher', subagentKind: 'researcher', parentSessionId: 'sess_501', invokedAt: new Date(now - 6000000).toISOString(), status: 'success', wallTimeMs: 82300, stepsTaken: 7, t1EntryId: 't1_002', t2EntryId: 't2_002', returnData: { output: { findings: ['JWT rotation uses atomic CAS', 'Refresh tokens have 60s TTL denylist'], sources: ['code_1002', 'decision_1001'], summary: 'Auth rotation is well-implemented', confidence: 0.92 }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_002', t2EntryId: 't2_002' } },
    { id: 'inv_003', subagentId: 'sa_tester', subagentKind: 'tester', parentSessionId: 'sess_501', invokedAt: new Date(now - 4800000).toISOString(), status: 'timeout', wallTimeMs: 90000, stepsTaken: 5, t1EntryId: undefined, t2EntryId: undefined, returnData: { output: null, outputMatchesSchema: false }, absorbResult: undefined },
    { id: 'inv_004', subagentId: 'sa_reviewer', subagentKind: 'reviewer', parentSessionId: 'sess_501', invokedAt: new Date(now - 3600000).toISOString(), status: 'success', wallTimeMs: 32100, stepsTaken: 3, t1EntryId: 't1_003', t2EntryId: 't2_003', returnData: { output: { issues: ['Missing rate limit on refresh endpoint'], severity: 'medium', summary: 'One medium issue found', recommendations: ['Add rate limiting to /auth/refresh'] }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_003', t2EntryId: 't2_003' } },
    { id: 'inv_005', subagentId: 'sa_docs', subagentKind: 'docs-writer', parentSessionId: 'sess_501', invokedAt: new Date(now - 3000000).toISOString(), status: 'error', wallTimeMs: 15000, stepsTaken: 2, t1EntryId: undefined, t2EntryId: undefined, returnData: { output: { error: 'ENOENT: no such file or directory' }, outputMatchesSchema: false }, absorbResult: undefined },
    { id: 'inv_006', subagentId: 'sa_planner', subagentKind: 'planner', parentSessionId: 'sess_501', invokedAt: new Date(now - 2400000).toISOString(), status: 'success', wallTimeMs: 35200, stepsTaken: 5, t1EntryId: 't1_004', t2EntryId: 't2_004', returnData: { output: { steps: ['Analyze billing meter', 'Implement usage tracking', 'Add true-up job'], dependencies: ['billing/meter.ts'], estimatedHours: 8, riskLevel: 'low' }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_004', t2EntryId: 't2_004' } },
    { id: 'inv_007', subagentId: 'sa_debugger', subagentKind: 'debugger', parentSessionId: 'sess_501', invokedAt: new Date(now - 1800000).toISOString(), status: 'success', wallTimeMs: 65400, stepsTaken: 8, t1EntryId: 't1_005', t2EntryId: undefined, returnData: { output: { rootCause: 'Race condition in token version CAS', severity: 'high', fix: 'Use distributed lock before CAS operation', testCases: ['concurrent-refresh-test'] }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_005', t2EntryId: 't2_005' } },
    { id: 'inv_008', subagentId: 'sa_security', subagentKind: 'security-auditor', parentSessionId: 'sess_501', invokedAt: new Date(now - 1200000).toISOString(), status: 'success', wallTimeMs: 28100, stepsTaken: 4, t1EntryId: 't1_006', t2EntryId: 't2_005', returnData: { output: { findings: ['No CORS header on /auth/refresh'], severity: 'low', summary: 'Low severity: missing CORS header', recommendations: ['Add CORS middleware to auth routes'] }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_006', t2EntryId: 't2_005' } },
    { id: 'inv_009', subagentId: 'sa_coder', subagentKind: 'coder', parentSessionId: 'sess_502', invokedAt: new Date(now - 900000).toISOString(), status: 'success', wallTimeMs: 120500, stepsTaken: 12, t1EntryId: 't1_007', t2EntryId: 't2_006', returnData: { output: { filesChanged: ['billing/meter.ts', 'billing/types.ts'], summary: 'Implemented usage-based metering', testsAdded: 3 }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_007', t2EntryId: 't2_006' } },
    { id: 'inv_010', subagentId: 'sa_reviewer', subagentKind: 'reviewer', parentSessionId: 'sess_502', invokedAt: new Date(now - 600000).toISOString(), status: 'success', wallTimeMs: 28700, stepsTaken: 3, t1EntryId: 't1_008', t2EntryId: 't2_007', returnData: { output: { issues: [], severity: 'none', summary: 'Code looks good, no issues found', recommendations: ['Consider adding error boundaries'] }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_008', t2EntryId: 't2_007' } },
    { id: 'inv_011', subagentId: 'sa_researcher', subagentKind: 'researcher', parentSessionId: 'sess_502', invokedAt: new Date(now - 300000).toISOString(), status: 'success', wallTimeMs: 67800, stepsTaken: 6, t1EntryId: 't1_009', t2EntryId: 't2_008', returnData: { output: { findings: ['Metering follows Stripe usage-based pattern', 'Events ring buffer prevents data loss'], sources: ['code_1006', 'decision_1005'], summary: 'Metering architecture is solid', confidence: 0.88 }, outputMatchesSchema: true }, absorbResult: { t1EntryId: 't1_009', t2EntryId: 't2_008' } },
    { id: 'inv_012', subagentId: 'sa_debugger', subagentKind: 'debugger', parentSessionId: 'sess_502', invokedAt: new Date(now - 120000).toISOString(), status: 'error', wallTimeMs: 45000, stepsTaken: 4, t1EntryId: undefined, t2EntryId: undefined, returnData: { output: { error: 'Subagent timed out during log analysis' }, outputMatchesSchema: false }, absorbResult: undefined },
  ];

  const sandboxPlugins: SandboxPlugin[] = [
    { name: 'context-bridge', kind: 'agent-binding', state: 'active', entryPoint: 'dist/index.js', crashCount: 0 },
    { name: 'code-review-agent', kind: 'agent', state: 'active', entryPoint: 'dist/agent.js', crashCount: 1 },
    { name: 'prompt-studio', kind: 'skill', state: 'inactive', entryPoint: 'dist/skill.js', crashCount: 0 },
    { name: 'memory-weather', kind: 'skill', state: 'inactive', entryPoint: 'dist/main.js', crashCount: 0 },
    { name: 'ollama-embedder', kind: 'embedding-model', state: 'active', entryPoint: 'dist/embed.js', crashCount: 2 },
    { name: 'smart-compress', kind: 'compression-strategy', state: 'active', entryPoint: 'dist/compress.js', crashCount: 0 },
    { name: 'grafana-viz', kind: 'visualization', state: 'crashed', entryPoint: 'dist/viz.js', crashCount: 3 },
  ];

  const mcpServers: MCPDefinition[] = [
    { id: 'mcp_fs', name: 'filesystem', transport: 'stdio', enabled: true, tools: 8, resources: 12 },
    { id: 'mcp_gh', name: 'github', transport: 'sse', enabled: true, tools: 15, resources: 6 },
    { id: 'mcp_db', name: 'database', transport: 'stdio', enabled: false, tools: 6, resources: 0 },
    { id: 'mcp_slack', name: 'slack', transport: 'sse', enabled: true, tools: 4, resources: 3 },
    { id: 'mcp_search', name: 'web-search', transport: 'sse', enabled: true, tools: 2, resources: 0 },
    { id: 'mcp_mg', name: 'memory-graph', transport: 'sse', enabled: true, tools: 5, resources: 8 },
    { id: 'mcp_notif', name: 'notifications', transport: 'stdio', enabled: false, tools: 1, resources: 0 },
  ];

  const mcpTokens = [
    { id: 'tok_dev_client', client: 'dev-cli', scopes_json: '["memory.read","memory.write","tools.call"]', expires_at: new Date(now + 86400000 * 90).toISOString() },
    { id: 'tok_monitor', client: 'monitor', scopes_json: '["resources.read"]', expires_at: new Date(now + 86400000 * 30).toISOString() },
  ];

  const bindings: BindingDefinition[] = [
    { platform: 'claude-code', state: 'active', configPath: '.mcp.json' },
    { platform: 'cursor', state: 'active', configPath: '.cursor/mcp.json' },
    { platform: 'cline', state: 'not_installed' },
    { platform: 'codex', state: 'active', configPath: '.codex/mcp.json' },
    { platform: 'continue', state: 'not_installed' },
    { platform: 'aider', state: 'not_installed' },
    { platform: 'opencode', state: 'not_installed' },
  ];

  const settingsOverrides: Record<string, Record<string, unknown>> = {
    '@orqenix/memory': { memoryTier: 'T2', injectionStrategy: 'C', maxTokensPerLevel: 4096, enableHierarchy: true },
    '@orqenix/storage': { kbPath: '~/.orqenix/kb', vectorDim: 384, enableWAL: true, syncInterval: 300 },
    '@orqenix/search': { algorithm: 'semantic', topK: 10, minScore: 0.65, rerankEnabled: true },
    '@orqenix/mesh': { discoveryMode: 'mdns', autoReconnect: true, maxPeers: 16, heartbeatMs: 15000 },
    '@orqenix/cloud-sync': { enabled: false, provider: 's3', interval: 3600, encrypt: true },
    '@orqenix/self-learning': { observerEnabled: true, minOccurrences: 5, minSuccessRate: 0.8, cooldownHours: 24 },
    '@orqenix/plugins': { sandboxMode: 'process', allowUnsigned: false, maxMemoryMb: 256, logLevel: 'info' },
  };
  const settings = { theme: 'editorial', memoryTier: 'T2', searchAlgorithm: 'semantic', autoLearn: true, cloudSync: false };

  // Agent configs (markdown files)
  const agentConfigs: Record<string, string> = {
    lead: `# Lead Agent

agent type: primary agent

## System Prompt
You are the lead agent responsible for orchestrating the team. Delegate tasks to subagents based on their specialties. Review outputs and ensure quality.

## Goal
Coordinate the team to deliver high-quality code with proper testing and documentation.

## Constraints
- Max concurrent subagents: 4
- Timeout per subagent: 300s
- Required approvals before merge: 2
- Allowed tools: read_memory, search_code, spawn_subagent
- Forbidden tools: write_file, execute_command
`,
    architect: `# Architect

agent type: primary agent

## System Prompt
You are the system architect. Design system architecture, define interfaces, review technical decisions, and ensure architectural consistency across the project.

## Goal
Design scalable, maintainable architecture and ensure all components follow established patterns and conventions.

## Constraints
- Max concurrent reviews: 3
- Timeout per review: 240s
- Required sign-off before implementation: 1
- Allowed tools: read_memory, search_code, read_file
- Forbidden tools: write_file, execute_command, git_commit
`,
    devops: `# DevOps

agent type: primary agent

## System Prompt
You are the DevOps agent. Manage CI/CD pipelines, infrastructure configuration, deployment workflows, and monitoring setup.

## Goal
Ensure reliable, automated deployment pipelines and maintain infrastructure health across all environments.

## Constraints
- Max concurrent deployments: 2
- Timeout per deployment: 600s
- Required approvals for production: 2
- Allowed tools: read_file, execute_command, search_code
- Forbidden tools: git_commit (use pipeline instead)
`,
    researcher: `# Researcher

agent type: sub agent

## System Prompt
You are a research agent. Gather information from knowledge bases and external sources. Synthesize findings into structured summaries.

## Goal
Research the given topic and produce a structured summary with sources and confidence scores.

## Constraints
- Max steps: 10
- Max wall time: 180s
- Allowed tools: read_memory, web_search, search_code
- Forbidden tools: write_file, execute_command, git_commit
`,
    coder: `# Coder

agent type: sub agent

## System Prompt
You are a code generation agent. Write clean, well-documented code following project conventions.

## Goal
Implement the requested features with proper error handling and tests.

## Constraints
- Max steps: 15
- Max wall time: 240s
- Allowed tools: read_file, write_file, execute_command, search_code
- Forbidden tools: git_commit
`,
    tester: `# Tester

agent type: sub agent

## System Prompt
You are a test runner agent. Execute test suites, report failures, and suggest fixes.

## Goal
Run the full test suite and report results with coverage metrics.

## Constraints
- Max steps: 5
- Max wall time: 90s
- Allowed tools: read_file, execute_command
- Forbidden tools: write_file, git_commit
`,
    reviewer: `# Reviewer

agent type: sub agent

## System Prompt
You are a code reviewer. Review code changes against memory patterns and best practices. Provide actionable feedback with severity levels.

## Goal
Review the latest diff and identify potential issues, security concerns, and improvements.

## Constraints
- Max steps: 8
- Max wall time: 120s
- Allowed tools: read_file, search_code, read_memory
- Forbidden tools: write_file, execute_command
`,
    'docs-writer': `# Docs Writer

agent type: sub agent

## System Prompt
You are a documentation generator. Create clear, comprehensive documentation from code and memory entries.

## Goal
Generate documentation that is accurate, well-structured, and useful for developers.

## Constraints
- Max steps: 10
- Max wall time: 180s
- Allowed tools: read_file, read_memory, search_code
- Forbidden tools: write_file, execute_command, git_commit
`,
    memory: `# Memory Service

agent type: service

## Description
Central knowledge base service for storing and retrieving memory entries.

## Configuration
- Storage backend: SQLite
- Vector dimensions: 384
- Index type: HNSW
- Max entries: 100,000
`,
    planner: `# Planner

agent type: sub agent

## System Prompt
You are a planning agent. Decompose complex tasks into manageable steps, identify dependencies, and estimate effort.

## Goal
Analyze the given task and produce a structured plan with milestones and resource allocations.

## Constraints
- Max steps: 6
- Max wall time: 60s
- Allowed tools: read_memory, search_code
- Forbidden tools: write_file, execute_command
`,
    debugger: `# Debugger

agent type: sub agent

## System Prompt
You are a debugger agent. Methodically isolate bugs, examine logs and stack traces, and propose verified fixes.

## Goal
Identify the root cause of the reported issue and provide a reproducible fix.

## Constraints
- Max steps: 10
- Max wall time: 150s
- Allowed tools: read_file, execute_command, search_code, read_memory
- Forbidden tools: write_file, git_commit
`,
    security: `# Security Auditor

agent type: sub agent

## System Prompt
You are a security auditor. Review code for vulnerabilities, check dependency trees, and enforce security policies.

## Goal
Perform a security audit and report findings with severity levels and remediation steps.

## Constraints
- Max steps: 8
- Max wall time: 120s
- Allowed tools: read_file, search_code, read_memory
- Forbidden tools: write_file, execute_command, git_commit
`,
  };

  // Agent definitions — structured data matching AgentFile from @orqenix/core
  const agentDefinitions: AgentDefinition[] = [
    {
      id: 'lead', name: 'lead', mode: 'primary', role: 'orchestration & delegation',
      isTeamLead: true, managesAgents: ['researcher', 'coder', 'tester', 'debugger', 'security-auditor'],
      description: 'Lead agent responsible for orchestrating the team and delegating tasks',
      model: 'anthropic/claude-sonnet-4-20250514', temperature: 0.3, maxSteps: 20,
      tools: { read_memory: true, search_code: true, spawn_subagent: true, write_file: false, execute_command: false },
      costBudgetTokens: 100000, protectContext: true,
      permission: { spawn_subagent: 'allow', write_file: 'ask', git_commit: 'deny' },
      prompt: 'You are the team lead. Delegate clearly and never write code yourself.',
      disable: false,
      knowledge_briefing: true, briefing_kbs: ['decisions', 'docs', 'code'], briefing_max_tokens: 4000,
      capture_decisions: true, reindex_after: 'auto',
      writes: ['docs', 'tests'], lazyAgents: ['researcher', 'tester'],
      fallback_model: 'ollama/qwen2.5-coder', config: '',
    },
    {
      id: 'architect', name: 'architect', mode: 'primary', role: 'system design & review',
      isTeamLead: false, managesAgents: ['reviewer', 'planner'],
      description: 'System architect for design, interfaces, and technical decisions',
      model: 'anthropic/claude-sonnet-4-20250514', temperature: 0.2, maxSteps: 12,
      tools: { read_memory: true, search_code: true, read_file: true, write_file: false, execute_command: false },
      costBudgetTokens: 80000, protectContext: true,
      permission: { read_file: 'allow', write_file: 'ask', git_commit: 'deny' },
      prompt: 'You are the system architect. Favor simplicity and clear interfaces.',
      disable: false,
      knowledge_briefing: true, briefing_kbs: ['decisions', 'code'], briefing_max_tokens: 3000,
      capture_decisions: true, reindex_after: 'code',
      writes: ['docs', 'code'], lazyAgents: ['planner'],
      fallback_model: 'anthropic/claude-opus-4-20250514', config: '',
    },
    {
      id: 'devops', name: 'devops', mode: 'primary', role: 'CI/CD & infrastructure',
      isTeamLead: false, managesAgents: ['coder', 'docs-writer'],
      description: 'DevOps agent for pipelines, deployment, and infrastructure',
      model: 'anthropic/claude-sonnet-4-20250514', temperature: 0.3, maxSteps: 15,
      tools: { read_file: true, execute_command: true, search_code: true, write_file: false, git_commit: false },
      costBudgetTokens: 60000, protectContext: false,
      permission: { execute_command: 'allow', git_commit: 'ask', write_file: 'allow' },
      prompt: 'You are the DevOps agent. Automate everything and keep pipelines green.',
      disable: false,
      knowledge_briefing: false, briefing_kbs: ['docs'], briefing_max_tokens: 2000,
      capture_decisions: false, reindex_after: 'docs',
      writes: ['code', 'config'], lazyAgents: ['docs-writer'],
      fallback_model: 'ollama/qwen2.5-coder', config: '',
    },
  ];

  return {
    projectId: 'orqenix-main', entries, library,
    links: [{ from: 'decision_1001', to: 'lesson_1004' }, { from: 'decision_1005', to: 'code_1006' }],
    team, sessions, candidates, audit, matrix,
    branches, marketplace, installedItems: ['context-bridge', 'ollama-embedder', 'smart-compress', 'tree-sitter-code'], plugins, skills, meshPeers, observability, subagents, subagentHarnesses, subagentInvocations, sandboxPlugins, mcpServers, mcpTokens, agentConfigs, agentDefinitions, syncResults: [], bindings, settings, settingsOverrides, observerEnabled: true,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __orqenixStore: Store | undefined;
}

function store(): Store {
  if (!globalThis.__orqenixStore) globalThis.__orqenixStore = seed();
  return globalThis.__orqenixStore;
}

// ---- READS -----------------------------------------------------------------

export function getDashboard() {
  const s = store();
  // Compute matrix fresh every read so it stays in sync with writes.
  const matrix: Record<string, Record<string, number>> = { T1: {}, T2: {}, T3: {}, T4: {} };
  for (const e of s.entries) {
    const row = matrix[e.tier];
    if (!row) continue;
    row[e.kb] = (row[e.kb] ?? 0) + 1;
  }
  return {
    projectId: s.projectId,
    totalEntries: s.entries.length,
    sessions: { active: s.sessions.filter((x) => x.state === 'running').length, total: s.sessions.length },
    auditValid: s.audit.every((a) => a.valid),
    learning: s.candidates,
    matrix,
    kbLabel: KB_LABEL,
  };
}

export interface MemoryGraphFilters { tier?: Tier; kb?: KbKind; branchId?: string; memoryLevel?: MemoryLevel; }

export function getMemoryGraph(filters: MemoryGraphFilters = {}) {
  const s = store();
  const entries = s.entries.filter(
    (e) =>
      (!filters.tier || e.tier === filters.tier) &&
      (!filters.kb || e.kb === filters.kb) &&
      (!filters.branchId || e.branch_id === filters.branchId) &&
      (!filters.memoryLevel || e.memory_level === filters.memoryLevel),
  );
  const branchNodes: GraphNode[] = s.branches.map<GraphNode>((b) => ({
    id: `branch:${b.branch_id}`,
    label: b.branch_name,
    type: 'branch',
    count: entries.filter((e) => e.branch_id === b.branch_id).length,
  }));
  const nodes: GraphNode[] = [
    { id: 'project', label: s.projectId, type: 'project' },
    ...(['chat', 'code', 'decision', 'lesson'] as KbKind[]).map<GraphNode>((kb) => ({ id: `kb_${kb}`, label: KB_LABEL[kb], type: 'kb', kb, count: entries.filter((e) => e.kb === kb).length })),
    ...branchNodes,
    ...entries.map<GraphNode>((e) => ({ id: `entry:${e.id}`, label: e.content.slice(0, 28) + '…', type: 'entry', kb: e.kb, tier: e.tier })),
  ];
  const edges: GraphEdge[] = [
    ...s.branches.map<GraphEdge>((b) => ({ from: 'project', to: `branch:${b.branch_id}`, type: 'contains' as const })),
    ...(['chat', 'code', 'decision', 'lesson'] as KbKind[]).map<GraphEdge>((kb) => ({ from: 'project', to: `kb_${kb}`, type: 'contains' as const })),
    ...entries.map<GraphEdge>((e) => ({ from: `kb_${e.kb}`, to: `entry:${e.id}`, type: 'contains' as const })),
    ...entries.map<GraphEdge>((e) => ({ from: `branch:${e.branch_id}`, to: `entry:${e.id}`, type: 'contains' as const })),
    ...s.links.map<GraphEdge>((l) => ({ from: `entry:${l.from}`, to: `entry:${l.to}`, type: 'linked' as const, label: 'linked' })),
  ];
  return { nodes, edges };
}

export function queryEntries(limit = 100, filters: MemoryGraphFilters = {}) {
  const s = store();
  const filtered = s.entries.filter(
    (e) =>
      (!filters.tier || e.tier === filters.tier) &&
      (!filters.kb || e.kb === filters.kb) &&
      (!filters.branchId || e.branch_id === filters.branchId) &&
      (!filters.memoryLevel || e.memory_level === filters.memoryLevel),
  );
  return filtered.slice(-limit).reverse();
}

export function getEntry(id: string) {
  const e = store().entries.find((x) => x.id === id);
  if (!e) return null;
  const s = store();
  return { ...e, links: s.links.filter((l) => l.from === id || l.to === id) };
}

export function getLibrary() { return store().library; }
export function getTeam() { return store().team; }
export function getSessions() { return store().sessions; }

// ── Session lifecycle (matches orqenix_report_session_start/resume/promote) ──
export function startSession(agentName: string, agentPlatform: string, parentSessionId?: string): Session {
  const s = store();
  const id = `sess_${Date.now().toString(36)}`;
  const sess: Session = {
    session_id: id, agent_name: agentName, state: 'running',
    started_at: new Date().toISOString(), progress: 0,
    agent_platform: agentPlatform, parent_session_id: parentSessionId, promoted_entries: 0,
  };
  s.sessions.unshift(sess);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.start', id, agentName, agentPlatform } });
  return sess;
}

export function resumeSession(id: string): boolean {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess || sess.state !== 'paused') return false;
  sess.state = 'running';
  sess.paused_at = undefined;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.resume', id } });
  return true;
}

export function pauseSession(id: string): boolean {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess || sess.state !== 'running') return false;
  sess.state = 'paused';
  sess.paused_at = new Date().toISOString();
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.pause', id } });
  return true;
}

export function abortSession(id: string): boolean {
  const s = store();
  const idx = s.sessions.findIndex((x) => x.session_id === id);
  if (idx < 0) return false;
  s.sessions.splice(idx, 1);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.abort', id } });
  return true;
}

export function promoteSessionMemory(id: string): number {
  const s = store();
  const sess = s.sessions.find((x) => x.session_id === id);
  if (!sess) return 0;
  // Simulate promoting session-level entries to branch level
  const promoted = Math.floor(Math.random() * 3) + 1;
  sess.promoted_entries = (sess.promoted_entries ?? 0) + promoted;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'session.promote', id, promoted } });
  return promoted;
}

export function getCandidates() { return store().candidates; }
export function getAudit() { return store().audit; }
export function getBranches() { return store().branches; }
export function getMarketplace() {
  const s = store();
  return s.marketplace.map((m) => ({ ...m, installed: s.installedItems.includes(m.name) }));
}
export function getPlugins() { return store().plugins; }
export function getSkills() { return store().skills; }
export function getMeshPeers() { return store().meshPeers; }
export function getObservability() { return store().observability; }
export function getSubagents() { return store().subagents; }
export function getSubagentHarnesses() { return store().subagentHarnesses; }
export function getSubagentInvocations() { return store().subagentInvocations; }
export function getSandboxPlugins() { return store().sandboxPlugins; }
export function getMCPServers() { return store().mcpServers; }
export function getBindings() { return store().bindings; }
export function getSettings() { return store().settings; }

export function getObserverConfig() {
  return { enabled: store().observerEnabled, scope: 'project', piiFilter: true };
}

export function setObserverConfig(enabled: boolean) {
  store().observerEnabled = enabled;
  eventBus.emit({ kind: 'runtime.ready', actor: 'system', payload: { op: 'observer', enabled } });
  return true;
}

// ---- WRITES (emit events) --------------------------------------------------

export function pinEntry(entryId: string, kb: KbKind) {
  const s = store();
  const e = s.entries.find((x) => x.id === entryId);
  if (!e) return false;
  if (s.library.some((l) => l.entryId === entryId)) return false;
  s.library.push({ entryId, kb: e.kb, content: (e.content.slice(0, 60) ?? '') + '…' });
  eventBus.emit({ kind: 'memory.write', actor: 'you', payload: { op: 'pin', entryId, kb: e.kb } });
  return true;
}

export function unpinEntry(entryId: string) {
  const s = store();
  const before = s.library.length;
  s.library = s.library.filter((l) => l.entryId !== entryId);
  if (s.library.length !== before) {
    eventBus.emit({ kind: 'memory.write', actor: 'you', payload: { op: 'unpin', entryId } });
    return true;
  }
  return false;
}

export function linkEntries(from: string, to: string) {
  const s = store();
  if (s.links.some((l) => l.from === from && l.to === to)) return false;
  s.links.push({ from, to });
  eventBus.emit({ kind: 'memory.write', actor: 'you', payload: { op: 'link', from, to } });
  return true;
}

// Maps to MCP tool orqenix_promote_to_branch: promotes a session/project-level
// entry up to branch level, creating a promoted copy that preserves provenance.
export function promoteToBranch(entryId: string, targetBranchId: string): { newId: string } | null {
  const s = store();
  const entry = s.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  const branch = s.branches.find((b) => b.branch_id === targetBranchId);
  if (!branch) return null;
  // Already at branch/project level on the target branch → no-op but success.
  if (entry.memory_level !== 'session' && entry.branch_id === targetBranchId) return { newId: entry.id };
  const promotedId = `${entry.kb}_p${1000 + s.entries.length}`;
  const promoted: MemoryEntry = {
    ...entry,
    id: promotedId,
    memory_level: 'branch',
    branch_id: targetBranchId,
    created_at: new Date().toISOString(),
    pinned: false,
  };
  s.entries.push(promoted);
  s.links.push({ from: `entry:${entry.id}`, to: `entry:${promotedId}` });
  eventBus.emit({ kind: 'memory.write', actor: 'you', payload: { op: 'promote_to_branch', entryId, kb: entry.kb, targetBranch: targetBranchId, newId: promotedId } });
  return { newId: promotedId };
}

export function createBranch(parentBranchId: string, newBranchName: string): { branchId: string; indexRowsCloned: number } | null {
  const s = store();
  const parent = s.branches.find((b) => b.branch_id === parentBranchId);
  if (!parent) return null;
  const hash = 'blake3:' + newBranchName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + Date.now().toString(36);
  const branch: Branch = { branch_id: hash, branch_name: newBranchName, created_at: new Date().toISOString(), cloned_from_branch_id: parentBranchId, sessions: 0 };
  s.branches.push(branch);
  eventBus.emit({ kind: 'memory.write', actor: 'you', payload: { op: 'create_branch', branchId: hash, parent: parentBranchId } });
  const indexRowsCloned = Math.floor(Math.random() * 20) + 5;
  return { branchId: hash, indexRowsCloned };
}

export function setBindingState(platform: string, state: BindingDefinition['state'], configPath?: string) {
  const s = store();
  const existing = s.bindings.find((b) => b.platform === platform);
  if (existing) {
    existing.state = state;
    if (configPath !== undefined) existing.configPath = configPath;
  } else {
    s.bindings.push({ platform: platform as BindingPlatform, state, configPath });
  }
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'binding.' + state, platform } });
  return true;
}

export function toggleInstall(name: string): boolean {
  const s = store();
  const idx = s.installedItems.indexOf(name);
  if (idx >= 0) {
    s.installedItems.splice(idx, 1);
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'marketplace.uninstall', name } });
  } else {
    s.installedItems.push(name);
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'marketplace.install', name } });
  }
  return true;
}

export function setCandidateStatus(id: string, status: LearningCandidate['status']) {
  const c = store().candidates.find((x) => x.id === id);
  if (!c) return false;
  c.status = status;
  eventBus.emit({ kind: 'learning.candidate', actor: 'you', payload: { id, name: c.name, status } });
  return true;
}

export function saveTeam(patch: { nodes: TeamNode[]; edges: TeamEdge[] }) {
  store().team = patch;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'team.save', nodes: patch.nodes.length, edges: patch.edges.length } });
  return true;
}

// ── SyncEngine (simulated) ───────────────────────────────────────────────────
// Mirrors SyncEngine.syncTeam() from @orqenix/core: compiles team agents to
// OpenCode-compatible output, reports written/skipped/drift/conflicts.
export function getSyncResults(): SyncResult[] { return store().syncResults; }

export function runSync(mode: SyncMode, teamId = 'orqenix-main'): SyncResult {
  const s = store();
  const agentNodes = s.team.nodes.filter((n) => n.type === 'agent' || n.type === 'subagent');
  const written: string[] = [];
  const skipped: string[] = [];
  const drift: { agent: string; description: string }[] = [];
  const conflicts: SyncConflict[] = [];

  for (const node of agentNodes) {
    const filename = `.opencode/agents/${teamId}-${node.name}.md`;
    // Deterministic-ish simulation: ~1 in 4 agents shows drift, lead has a conflict
    const r = (node.id.length + node.name.length) % 4;
    if (node.id === 'lead') {
      conflicts.push({
        agent: node.name,
        sourceHash: 'b3f' + Math.random().toString(16).slice(2, 8),
        outputHash: 'a1c' + Math.random().toString(16).slice(2, 8),
        resolution: 'orqenix-wins',
      });
    } else if (r === 0) {
      drift.push({ agent: node.name, description: 'External edit detected in output file — content hash mismatched' });
    } else if (mode === 'verify') {
      skipped.push(filename);
    } else {
      written.push(filename);
    }
  }

  const status: SyncResult['status'] = conflicts.length ? 'conflicts' : drift.length ? 'drift-detected' : 'success';
  const result: SyncResult = { timestamp: new Date().toISOString(), teamId, mode, written, skipped, drift, conflicts, status };
  s.syncResults.unshift(result);
  if (s.syncResults.length > 12) s.syncResults.length = 12;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'team.sync', mode, status, count: written.length } });
  return result;
}

// ---- Subagent Spawn --------------------------------------------------------

export function spawnSubagent(subagentId: string): SubagentInvocationRecord | null {
  const s = store();
  const sub = s.subagents.find((x) => x.id === subagentId);
  if (!sub) return null;
  const stepsTaken = Math.floor(Math.random() * 8) + 1;
  const wallTimeMs = Math.floor(Math.random() * 60000) + 5000;
  const t1 = `t1_${Math.floor(Math.random() * 900) + 100}`;
  const t2 = `t2_${Math.floor(Math.random() * 900) + 100}`;
  const inv: SubagentInvocationRecord = {
    id: `inv_${Date.now().toString(36)}`,
    subagentId,
    subagentKind: sub.name,
    parentSessionId: 'sess_501',
    invokedAt: new Date().toISOString(),
    status: 'success',
    wallTimeMs,
    stepsTaken,
    t1EntryId: t1,
    t2EntryId: t2,
    returnData: { output: { summary: `Completed ${stepsTaken} steps` }, outputMatchesSchema: true },
    absorbResult: { t1EntryId: t1, t2EntryId: t2 },
  };
  s.subagentInvocations.push(inv);
  sub.tasksCompleted += 1;
  sub.status = 'running';
  eventBus.emit({ kind: 'subagent.spawned', actor: sub.name, payload: { subagentId, invocationId: inv.id } });
  return inv;
}

export function setSubagentStatus(id: string, status: SubagentDef['status']) {
  const sub = store().subagents.find((x) => x.id === id);
  if (!sub) return false;
  sub.status = status;
  eventBus.emit({ kind: 'subagent.returned', actor: sub.name, payload: { subagentId: id, status } });
  return true;
}

// ---- Skill Toggle ----------------------------------------------------------

export function toggleSkill(id: string): boolean {
  const s = store().skills.find((x) => x.id === id);
  if (!s) return false;
  s.enabled = !s.enabled;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'skill.toggle', id, name: s.name, enabled: s.enabled } });
  return true;
}

// ---- Plugin Toggle ---------------------------------------------------------

export function togglePlugin(id: string): boolean {
  const p = store().plugins.find((x) => x.id === id);
  if (!p) return false;
  p.enabled = !p.enabled;
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'plugin.toggle', id, name: p.name, enabled: p.enabled } });
  return true;
}

// ---- Plugin Lifecycle ------------------------------------------------------

const LIFECYCLE_STAGES = ['install', 'configure', 'activate', 'deactivate', 'uninstall'] as const;
const lifecycleState = new Map<string, string>();

export function getPluginLifecycleState(kind: string): string {
  return lifecycleState.get(kind) ?? 'install';
}

export function advancePluginLifecycle(kind: string): string | null {
  const current = lifecycleState.get(kind) ?? 'install';
  const idx = LIFECYCLE_STAGES.indexOf(current as typeof LIFECYCLE_STAGES[number]);
  if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
  const next = LIFECYCLE_STAGES[idx + 1]!;
  lifecycleState.set(kind, next);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'plugin.lifecycle', kind, stage: next } });
  return next;
}

// ---- MCP Tokens ------------------------------------------------------------

export function issueMCPToken(client: string, scopes: string[]): { id: string; client: string; scopes_json: string; expires_at: string } {
  const tok = {
    id: `tok_${Date.now().toString(36)}`,
    client,
    scopes_json: JSON.stringify(scopes),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  // Store tokens alongside MCP data — keep them in a module-level array via the store
  const s = store();
  if (!Array.isArray((s as any).mcpTokens)) (s as any).mcpTokens = [];
  (s as any).mcpTokens.push(tok);
  eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'mcp.token.issue', client, id: tok.id } });
  return tok;
}

export function revokeMCPToken(id: string): boolean {
  const s = store() as any;
  if (!Array.isArray(s.mcpTokens)) return false;
  const before = s.mcpTokens.length;
  s.mcpTokens = s.mcpTokens.filter((t: any) => t.id !== id);
  if (s.mcpTokens.length !== before) {
    eventBus.emit({ kind: 'session.updated', actor: 'you', payload: { op: 'mcp.token.revoke', id } });
    return true;
  }
  return false;
}

export function getMCPTokens(): Array<{ id: string; client: string; scopes_json: string; expires_at: string }> {
  const s = store() as any;
  return Array.isArray(s.mcpTokens) ? s.mcpTokens : [];
}

// ---- Marketplace sync helpers ----------------------------------------------

export function syncMarketplaceInstall(name: string): void {
  const s = store();
  // If the marketplace item is a skill, add to skills array if not present
  const mkItem = s.marketplace.find((m) => m.name === name);
  if (!mkItem) return;

  if (mkItem.kind === 'skill' && !s.skills.some((sk) => sk.name === name)) {
    s.skills.push({
      id: `sk_auto_${Date.now().toString(36)}`,
      name,
      category: 'marketplace',
      version: mkItem.version,
      enabled: true,
      description: mkItem.description,
    });
    eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'marketplace.skill.installed', name } });
  }

  // If it's a plugin-like kind, add to plugins
  const PLUGIN_LIKE_KINDS = ['agent-binding', 'embedding-model', 'compression-strategy', 'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer', 'kb-schema', 'mcp-server', 'agent'];
  if (PLUGIN_LIKE_KINDS.includes(mkItem.kind) && !s.plugins.some((p) => p.name === name)) {
    s.plugins.push({
      id: `pl_auto_${Date.now().toString(36)}`,
      name,
      version: mkItem.version,
      enabled: true,
      description: mkItem.description,
      author: mkItem.author,
    });
    eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'marketplace.plugin.installed', name } });
  }
}

export function syncMarketplaceUninstall(name: string): void {
  const s = store();
  // Remove from skills
  s.skills = s.skills.filter((sk) => sk.name !== name);
  // Remove from plugins
  s.plugins = s.plugins.filter((p) => p.name !== name);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'marketplace.uninstalled', name } });
}

// ---- Prompt prompts for MCP -------------------------------------------------

export function getMCPPrompts(): Array<{ name: string; description: string }> {
  return [
    { name: 'code-review', description: 'Review a pull request for common issues' },
    { name: 'summarize-session', description: 'Summarize a session transcript into memory entries' },
    { name: 'generate-tests', description: 'Generate test cases for a code file' },
  ];
}

// ---- CRUD: Subagents --------------------------------------------------------

export function createSubagent(data: Omit<SubagentDef, 'id'>): SubagentDef {
  const s = store();
  const id = `sa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const agent: SubagentDef = { id, ...data };
  s.subagents.push(agent);
  eventBus.emit({ kind: 'subagent.spawned', actor: 'system', payload: { op: 'create', id, name: data.name } });
  return agent;
}

export function updateSubagent(id: string, data: Partial<SubagentDef>): SubagentDef | null {
  const s = store();
  const existing = s.subagents.find((a) => a.id === id);
  if (!existing) return null;
  const merged: SubagentDef = {
    id: existing.id,
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    status: data.status ?? existing.status,
    uptime: data.uptime ?? existing.uptime,
    tasksCompleted: data.tasksCompleted ?? existing.tasksCompleted,
    config: data.config ?? existing.config,
  };
  const idx = s.subagents.indexOf(existing);
  s.subagents[idx] = merged;
  eventBus.emit({ kind: 'subagent.returned', actor: 'system', payload: { op: 'update', id } });
  return merged;
}

export function deleteSubagent(id: string): boolean {
  const s = store();
  const idx = s.subagents.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  s.subagents.splice(idx, 1);
  eventBus.emit({ kind: 'subagent.returned', actor: 'system', payload: { op: 'delete', id } });
  return true;
}

// ---- CRUD: Skills -----------------------------------------------------------

export function createSkill(data: Omit<Skill, 'id'>): Skill {
  const s = store();
  const id = `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const skill: Skill = { id, ...data };
  s.skills.push(skill);
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'create.skill', id, name: data.name } });
  return skill;
}

export function updateSkill(id: string, data: Partial<Skill>): Skill | null {
  const s = store();
  const existing = s.skills.find((sk) => sk.id === id);
  if (!existing) return null;
  const merged: Skill = {
    id: existing.id,
    name: data.name ?? existing.name,
    category: data.category ?? existing.category,
    version: data.version ?? existing.version,
    enabled: data.enabled ?? existing.enabled,
    description: data.description ?? existing.description,
    config: data.config ?? existing.config,
  };
  const idx = s.skills.indexOf(existing);
  s.skills[idx] = merged;
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'update.skill', id } });
  return merged;
}

export function deleteSkill(id: string): boolean {
  const s = store();
  const idx = s.skills.findIndex((sk) => sk.id === id);
  if (idx === -1) return false;
  s.skills.splice(idx, 1);
  eventBus.emit({ kind: 'learning.candidate', actor: 'system', payload: { op: 'delete.skill', id } });
  return true;
}

// ---- CRUD: Plugins ----------------------------------------------------------

export function createPlugin(data: Omit<Plugin, 'id'>): Plugin {
  const s = store();
  const id = `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const plugin: Plugin = { id, ...data };
  s.plugins.push(plugin);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'create.plugin', id, name: data.name } });
  return plugin;
}

export function updatePlugin(id: string, data: Partial<Plugin>): Plugin | null {
  const s = store();
  const existing = s.plugins.find((p) => p.id === id);
  if (!existing) return null;
  const merged: Plugin = {
    id: existing.id,
    name: data.name ?? existing.name,
    version: data.version ?? existing.version,
    enabled: data.enabled ?? existing.enabled,
    description: data.description ?? existing.description,
    author: data.author ?? existing.author,
    config: data.config ?? existing.config,
  };
  const idx = s.plugins.indexOf(existing);
  s.plugins[idx] = merged;
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'update.plugin', id } });
  return merged;
}

export function deletePlugin(id: string): boolean {
  const s = store();
  const idx = s.plugins.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  s.plugins.splice(idx, 1);
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'delete.plugin', id } });
  return true;
}

// ---- Agent Configs -----------------------------------------------------------

export function getAgentConfig(agentId: string): string {
  return store().agentConfigs[agentId] ?? '';
}

export function setAgentConfig(agentId: string, config: string): void {
  store().agentConfigs[agentId] = config;
  eventBus.emit({ kind: 'session.updated', actor: 'system', payload: { op: 'agent.config.update', agentId } });
}

export function resetStore() {
  globalThis.__orqenixStore = seed();
  eventBus.emit({ kind: 'runtime.ready', payload: { op: 'reset' } });
  return true;
}
