import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ALL_MODULE_CONTRACTS } from '@/lib/settings-bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ensureOverrideTable(db: import('better-sqlite3').Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS config_overrides (
    module_id TEXT NOT NULL, key TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'project',
    value_json TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (module_id, key, scope)
  ) STRICT;`);
}

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureOverrideTable(db);
    const overrides = db.prepare('SELECT module_id, key, value_json FROM config_overrides').all() as Array<{ module_id: string; key: string; value_json: string }>;
    const overrideMap = new Map(overrides.map((o) => [`${o.module_id}::${o.key}`, JSON.parse(o.value_json)]));

    const groups = ALL_MODULE_CONTRACTS.map((c) => ({
      moduleId: c.moduleId,
      phase: c.provenance.phase,
      crVersion: c.provenance.crVersion,
      hotReloadable: c.hotReloadable,
      hierarchyOverride: c.hierarchyOverride,
      settings: Object.entries(c.defaults).map(([key, def]) => {
        const ovKey = `${c.moduleId}::${key}`;
        const overridden = overrideMap.has(ovKey);
        return { key, default: def, value: overridden ? overrideMap.get(ovKey) : def, overridden };
      }),
    }));

    return NextResponse.json({ groups }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'update' | 'reset'; moduleId: string; key: string; value?: unknown };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    ensureOverrideTable(db);
    const now = new Date().toISOString();

    if (body.action === 'update') {
      db.prepare(`INSERT INTO config_overrides (module_id, key, scope, value_json, updated_at) VALUES (?, ?, 'project', ?, ?)
                  ON CONFLICT(module_id, key, scope) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`)
        .run(body.moduleId, body.key, JSON.stringify(body.value), now);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'reset') {
      db.prepare('DELETE FROM config_overrides WHERE module_id=? AND key=?').run(body.moduleId, body.key);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
