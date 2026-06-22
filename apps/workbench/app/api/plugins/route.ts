// SPDX-License-Identifier: Apache-2.0
// W3.A , Plugins API — installed plugins management (activate/deactivate/configure)

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    let plugins: unknown[] = [];
    try {
      plugins = rt.engine.getStore().db.prepare(
        'SELECT package_name, version, kind, state, settings_json FROM installed_plugins ORDER BY kind, package_name'
      ).all();
    } catch { /* table may not exist yet */ }
    return NextResponse.json({ plugins }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: string; name: string; settings?: unknown };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    switch (body.action) {
      case 'activate':
        db.prepare("UPDATE installed_plugins SET state='active' WHERE package_name=?").run(body.name);
        return NextResponse.json({ ok: true });
      case 'deactivate':
        db.prepare("UPDATE installed_plugins SET state='installed' WHERE package_name=?").run(body.name);
        return NextResponse.json({ ok: true });
      case 'configure':
        db.prepare('UPDATE installed_plugins SET settings_json=? WHERE package_name=?')
          .run(JSON.stringify(body.settings ?? {}), body.name);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
