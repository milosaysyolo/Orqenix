// SPDX-License-Identifier: Apache-2.0
// W3.A , Skills API — list installed skills + invoke (audit-recorded)

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    let skills: unknown[] = [];
    try {
      skills = rt.engine.getStore().db.prepare(
        "SELECT package_name, version, state FROM installed_plugins WHERE kind='skill' ORDER BY package_name"
      ).all();
    } catch { /* table may not exist yet */ }
    return NextResponse.json({ skills }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'invoke'; skillName: string; input?: unknown };
    const rt = await getRuntime();
    if (body.action === 'invoke') {
      const entry = await rt.engine.write({
        kb: 'chat', content: `skill invoked: ${body.skillName}`,
        branch_id: 'blake3:main0000000000aabb', memory_level: 'branch',
      });
      return NextResponse.json({ ok: true, skillName: body.skillName, recordedAs: entry.id, output: { note: 'invocation recorded; sandbox exec wired with skill-runtime' } });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
