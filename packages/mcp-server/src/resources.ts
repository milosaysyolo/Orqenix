// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Resource definitions
//
// 9 MCP resources exposing Orqenix state per CR v8.0 Section 9.2.2.
// Resources are read-only; modifications go through tools.

import type { MemoryEngine } from '@orqenix/memory-engine';

export interface ResourceContext {
  engine: MemoryEngine;
}

export interface McpResourceDefinition {
  /** URI pattern (may contain <param> placeholders) */
  uriPattern: string;
  description: string;
  /** Matches a concrete URI against this pattern */
  matches(uri: string): boolean;
  /** Reads the resource content */
  read(uri: string, ctx: ResourceContext): Promise<unknown>;
}

function exact(pattern: string): (uri: string) => boolean {
  return (uri: string) => uri === pattern;
}

function prefix(pattern: string): (uri: string) => boolean {
  // pattern like 'orqenix://config/branch/' matches 'orqenix://config/branch/<id>'
  return (uri: string) => uri.startsWith(pattern);
}

// ─────────────────────────────────────────────────────────────────────────
// Resource 1: scope identity
// ─────────────────────────────────────────────────────────────────────────

const scopeIdentityResource: McpResourceDefinition = {
  uriPattern: 'orqenix://identity/scope',
  description: 'Scope identity (Ed25519 public key, project_id). Never exposes private key.',
  matches: exact('orqenix://identity/scope'),
  async read(_uri, ctx) {
    return {
      project_id: ctx.engine.projectId,
      // Public key + algorithm only; private key never exposed
      algorithm: 'Ed25519',
      note: 'Public identity only; private key remains in .orqenix/identity/scope.pem',
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 2: memory matrix snapshot
// ─────────────────────────────────────────────────────────────────────────

const memoryMatrixResource: McpResourceDefinition = {
  uriPattern: 'orqenix://memory/matrix',
  description: 'Memory × Knowledge Matrix snapshot (cell counts per tier × KB).',
  matches: exact('orqenix://memory/matrix'),
  async read(_uri, ctx) {
    // Aggregate cell counts via a lightweight query per KB
    const kbs: Array<'chat' | 'code' | 'decision' | 'lesson'> = [
      'chat',
      'code',
      'decision',
      'lesson',
    ];
    const snapshot: Record<string, Record<string, number>> = {
      T1: {},
      T2: {},
      T3: {},
      T4: {},
    };
    // Use engine store accessor for raw counts
    const store = ctx.engine.getStore();
    const KB_TABLE: Record<string, string> = {
      chat: 'chat_entries',
      code: 'code_entries',
      decision: 'decision_entries',
      lesson: 'lesson_entries',
    };
    for (const kb of kbs) {
      const rows = store.db
        .prepare(
          `SELECT tier, COUNT(*) AS c FROM ${KB_TABLE[kb]} WHERE project_id = ? GROUP BY tier`
        )
        .all(ctx.engine.projectId) as Array<{ tier: string; c: number }>;
      for (const r of rows) {
        const cell = snapshot[r.tier];
        if (cell) cell[kb] = r.c;
      }
    }
    return { matrix: snapshot };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 3: mesh peers
// ─────────────────────────────────────────────────────────────────────────

const meshPeersResource: McpResourceDefinition = {
  uriPattern: 'orqenix://mesh/peers',
  description: 'Linked peers (LAN + Cloud). Returns scope IDs + link states.',
  matches: exact('orqenix://mesh/peers'),
  async read(_uri, _ctx) {
    // Link state managed by @orqenix/link-state; MCP surface defined here.
    // For D8.α.7, return empty peers list (link state composed at engine level).
    return { peers: [], note: 'Mesh link state composed via @orqenix/link-state' };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 4: audit log (paginated)
// ─────────────────────────────────────────────────────────────────────────

const auditLogResource: McpResourceDefinition = {
  uriPattern: 'orqenix://audit/log',
  description: 'Audit log entries (paginated, most recent 100).',
  matches: prefix('orqenix://audit/log'),
  async read(uri, ctx) {
    // Optional ?sinceSeq=N&limit=M
    const url = new URL(uri.replace('orqenix://', 'https://orqenix.local/'));
    const sinceSeq = Number(url.searchParams.get('sinceSeq') ?? '0');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 100);
    const entries = ctx.engine.listAudit(sinceSeq, limit);
    return {
      entries: entries.map((e) => ({
        seq: e.seq,
        ts: e.ts,
        kind: e.kind,
        branch_id: e.branch_id,
        session_id: e.session_id,
        actor: e.actor,
        this_hash: e.this_hash,
      })),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 5-7: config (project / branch / session)
// ─────────────────────────────────────────────────────────────────────────

const projectConfigResource: McpResourceDefinition = {
  uriPattern: 'orqenix://config/project',
  description: 'Project-level configuration.',
  matches: exact('orqenix://config/project'),
  async read(_uri, ctx) {
    return { project_id: ctx.engine.projectId, level: 'project' };
  },
};

const branchConfigResource: McpResourceDefinition = {
  uriPattern: 'orqenix://config/branch/<id>',
  description: 'Branch-level configuration.',
  matches: prefix('orqenix://config/branch/'),
  async read(uri, _ctx) {
    const branchId = uri.replace('orqenix://config/branch/', '');
    return { branch_id: branchId, level: 'branch' };
  },
};

const sessionConfigResource: McpResourceDefinition = {
  uriPattern: 'orqenix://config/session/<id>',
  description: 'Session-level configuration.',
  matches: prefix('orqenix://config/session/'),
  async read(uri, _ctx) {
    const sessionId = uri.replace('orqenix://config/session/', '');
    return { session_id: sessionId, level: 'session' };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 8: registered skills
// ─────────────────────────────────────────────────────────────────────────

const skillsResource: McpResourceDefinition = {
  uriPattern: 'orqenix://skills/registered',
  description: 'All installed Orqenix skills.',
  matches: exact('orqenix://skills/registered'),
  async read(_uri, ctx) {
    // Skills are installed_plugins of kind 'skill'
    const store = ctx.engine.getStore();
    const rows = store.db
      .prepare(
        "SELECT package_name, version FROM installed_plugins WHERE kind = 'skill' AND state IN ('active','installed','configured')"
      )
      .all() as Array<{ package_name: string; version: string }>;
    return { skills: rows };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Resource 9: active plugins
// ─────────────────────────────────────────────────────────────────────────

const pluginsResource: McpResourceDefinition = {
  uriPattern: 'orqenix://plugins/active',
  description: 'All active plugins.',
  matches: exact('orqenix://plugins/active'),
  async read(_uri, ctx) {
    const store = ctx.engine.getStore();
    const rows = store.db
      .prepare(
        "SELECT package_name, version, kind FROM installed_plugins WHERE state = 'active'"
      )
      .all() as Array<{ package_name: string; version: string; kind: string }>;
    return { plugins: rows };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Aggregate: all 9 resources
// ─────────────────────────────────────────────────────────────────────────

export const ALL_RESOURCES: McpResourceDefinition[] = [
  scopeIdentityResource,
  memoryMatrixResource,
  meshPeersResource,
  auditLogResource,
  projectConfigResource,
  branchConfigResource,
  sessionConfigResource,
  skillsResource,
  pluginsResource,
];

export function getResource(uri: string): McpResourceDefinition | undefined {
  return ALL_RESOURCES.find((r) => r.matches(uri));
}
