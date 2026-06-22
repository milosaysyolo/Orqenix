// SPDX-License-Identifier: Apache-2.0
// AGENT PROMPT
// File: apps/workbench/app/api/mcp/route.ts
// Purpose: MCP Server status surface. GET server status + tools/resources/prompts + tokens.

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ALL_TOOLS, ALL_RESOURCES, ALL_PROMPTS } from '@orqenix/mcp-server';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ensureTokenTable(db: import('better-sqlite3').Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS mcp_tokens (
    id TEXT PRIMARY KEY, client TEXT NOT NULL, scopes_json TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active', issued_at TEXT NOT NULL, expires_at TEXT
  ) STRICT;`);
}

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureTokenTable(db);
    const tokens = db.prepare("SELECT id, client, scopes_json, state, expires_at FROM mcp_tokens WHERE state='active'").all();
    return NextResponse.json({
      status: 'running',
      endpoint: 'localhost:27420',
      transports: [
        { kind: 'stdio', state: 'connected' },
        { kind: 'http', state: 'connected', port: 27420 },
        { kind: 'websocket', state: 'idle', port: 27421 },
      ],
      tools: ALL_TOOLS.map((t) => ({ name: t.name, description: t.description, permission: t.permission ?? '\u2014' })),
      resources: ALL_RESOURCES.map((r) => ({ uri: r.uriPattern, description: r.description })),
      prompts: ALL_PROMPTS.map((p) => ({ name: p.name, description: p.description })),
      tokens,
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'issue' | 'revoke'; client?: string; scopes?: string[]; tokenId?: string };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureTokenTable(db);
    const now = new Date().toISOString();
    if (body.action === 'issue') {
      const id = ulid();
      const exp = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      db.prepare('INSERT INTO mcp_tokens (id, client, scopes_json, state, issued_at, expires_at) VALUES (?, ?, ?, \'active\', ?, ?)')
        .run(id, body.client ?? 'client', JSON.stringify((body.scopes ?? ['memory.read']).filter(Boolean)), now, exp);
      return NextResponse.json({ ok: true, tokenId: id, expiresAt: exp });
    }
    if (body.action === 'revoke') {
      db.prepare("UPDATE mcp_tokens SET state='revoked' WHERE id=?").run(body.tokenId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
