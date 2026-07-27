// SPDX-License-Identifier: Apache-2.0
// MCP token management — persisted when the engine is real; demo fallback otherwise

import type { Database } from 'better-sqlite3';
import { getDb } from '../engine-init';

export interface McpToken {
  id: string;
  client: string;
  scopes_json: string;
  expires_at: string;
}

export async function issueMcpToken(client: string, scopes: string[]): Promise<McpToken> {
  const db = getDb();
  const id = `tok_${Date.now().toString(36)}`;
  const scopes_json = JSON.stringify(scopes);
  const expires_at = new Date(Date.now() + 86400000).toISOString();
  if (!db) {
    const { issueMCPToken } = await import('@/lib/demo-store');
    return issueMCPToken(client, scopes);
  }
  db.prepare(
    `INSERT INTO mcp_tokens (id, client, scopes_json, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, client, scopes_json, expires_at, new Date().toISOString());
  return { id, client, scopes_json, expires_at };
}

export async function listMcpTokens(): Promise<McpToken[]> {
  const db = getDb();
  if (!db) {
    const { getMCPTokens } = await import('@/lib/demo-store');
    return getMCPTokens();
  }
  return db
    .prepare('SELECT id, client, scopes_json, expires_at FROM mcp_tokens ORDER BY created_at DESC')
    .all() as McpToken[];
}

export async function revokeMcpToken(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const { revokeMCPToken } = await import('@/lib/demo-store');
    return revokeMCPToken(id);
  }
  return db.prepare('DELETE FROM mcp_tokens WHERE id = ?').run(id).changes > 0;
}
