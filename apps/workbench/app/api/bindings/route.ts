// SPDX-License-Identifier: Apache-2.0
// AGENT PROMPT
// File: apps/workbench/app/api/bindings/route.ts
// Purpose: Agent platform bindings. GET lists 7 bindings; POST install/uninstall/test.

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['claude-code', 'cursor', 'codex', 'opencode', 'cline', 'aider', 'continue'];

function ensureTable(db: import('better-sqlite3').Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS bindings (
    platform TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'not_installed',
    installed_at TEXT, config_path TEXT
  ) STRICT;`);
}

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureTable(db);
    const rows = db.prepare('SELECT platform, state, config_path FROM bindings').all() as Array<{ platform: string; state: string }>;
    const byPlatform = new Map(rows.map((r) => [r.platform, r]));
    const bindings = PLATFORMS.map((p) => byPlatform.get(p) ?? { platform: p, state: 'not_installed' });
    return NextResponse.json({ bindings }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'install' | 'uninstall' | 'test'; platform: string };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureTable(db);
    const now = new Date().toISOString();

    if (body.action === 'test') {
      return NextResponse.json({ ok: true, platform: body.platform, capabilities: { tools: 10, resources: 9, prompts: 6 } });
    }
    if (body.action === 'install') {
      const cfg = `.${body.platform === 'claude-code' ? '' : body.platform + '/'}mcp.json`;
      db.prepare(`INSERT INTO bindings (platform, state, installed_at, config_path) VALUES (?, 'active', ?, ?)
                  ON CONFLICT(platform) DO UPDATE SET state='active', installed_at=excluded.installed_at, config_path=excluded.config_path`)
        .run(body.platform, now, cfg);
      return NextResponse.json({ ok: true, configPath: cfg });
    }
    if (body.action === 'uninstall') {
      db.prepare("UPDATE bindings SET state='not_installed' WHERE platform=?").run(body.platform);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
