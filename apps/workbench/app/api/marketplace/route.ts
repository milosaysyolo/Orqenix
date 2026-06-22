// SPDX-License-Identifier: Apache-2.0
// W3.A , Marketplace API — full CRUD + install + import/export via MarketplaceManager

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'installed';

    if (action === 'installed') {
      const db = rt.engine.getStore().db;
      let plugins: unknown[] = [];
      try {
        plugins = db.prepare(
          "SELECT package_name, version, kind, state FROM installed_plugins ORDER BY package_name"
        ).all();
      } catch { /* table may not exist yet */ }
      return NextResponse.json({ plugins }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: `unknown action ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action = body.action as string | undefined;

  try {
    const rt = await getRuntime();
    const mk = rt.marketplace;

    switch (action) {
      case 'search': {
        const results = await mk.search(String(body.query ?? ''), body.filters as never);
        return NextResponse.json({ plugins: results });
      }
      case 'create': {
        const r = await mk.create(body.input as never);
        return NextResponse.json(r);
      }
      case 'update': {
        const r = await mk.update(body.input as never);
        return NextResponse.json(r);
      }
      case 'delete': {
        const r = await mk.delete(body.input as never);
        return NextResponse.json(r);
      }
      case 'fork': {
        const r = await mk.fork(body.input as never);
        return NextResponse.json(r);
      }
      case 'import': {
        const r = await mk.import(body.input as never);
        return NextResponse.json(r);
      }
      case 'export': {
        const r = await mk.export(body.input as never);
        return NextResponse.json(r);
      }
      case 'install': {
        const db = rt.engine.getStore().db;
        const name = String(body.name);
        const now = new Date().toISOString();
        db.prepare(
          `INSERT INTO installed_plugins (package_name, version, kind, state, installed_at, settings_json)
           VALUES (?, ?, ?, 'installed', ?, '{}')
           ON CONFLICT(package_name) DO UPDATE SET state='installed', version=excluded.version`
        ).run(name, String(body.version ?? '0.0.0'), String(body.kind ?? 'skill'), now);
        return NextResponse.json({ ok: true, name });
      }
      case 'uninstall': {
        const db = rt.engine.getStore().db;
        db.prepare('DELETE FROM installed_plugins WHERE package_name = ?').run(String(body.name));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: `Invalid action ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
