import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const entryId = new URL(req.url).searchParams.get('entryId');
    if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });
    let links: unknown[] = [];
    try {
      links = db.prepare('SELECT * FROM memory_links WHERE entry_id = ? ORDER BY updated_at DESC').all(entryId);
    } catch { /* table */ }
    return NextResponse.json({ links }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: 'toggle' | 'create' | 'sever' | 'setActive';
      entryId: string; entryKb?: string; linkable?: boolean;
      fromScope?: string; toScope?: string; capabilities?: string[];
      crossSession?: boolean; crossBranch?: boolean; linkId?: string;
    };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();

    switch (body.action) {
      case 'toggle': {
        const existing = db.prepare('SELECT id FROM memory_links WHERE entry_id = ? LIMIT 1').get(body.entryId) as { id: string } | undefined;
        if (existing) {
          db.prepare('UPDATE memory_links SET linkable = ?, updated_at = ? WHERE id = ?')
            .run(body.linkable ? 1 : 0, now, existing.id);
        } else {
          db.prepare(
            `INSERT INTO memory_links (id, project_id, entry_id, entry_kb, linkable, from_scope, to_scope, capabilities_json, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '', '', '[]', 'created', ?, ?)`
          ).run(ulid(), rt.projectId, body.entryId, body.entryKb ?? 'decision', body.linkable ? 1 : 0, now, now);
        }
        return NextResponse.json({ ok: true, linkable: body.linkable });
      }
      case 'create': {
        const caps = (body.capabilities ?? ['read:decision']).filter((c) => c.startsWith('read:'));
        const id = ulid();
        db.prepare(
          `INSERT INTO memory_links (id, project_id, entry_id, entry_kb, linkable, from_scope, to_scope, capabilities_json, state, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'active', ?, ?)`
        ).run(id, rt.projectId, body.entryId, body.entryKb ?? 'decision', body.fromScope ?? '', body.toScope ?? '', JSON.stringify(caps), now, now);
        return NextResponse.json({ ok: true, linkId: id, state: 'active' });
      }
      case 'sever': {
        if (!body.linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });
        db.prepare("UPDATE memory_links SET state = 'severed', updated_at = ? WHERE id = ?").run(now, body.linkId);
        return NextResponse.json({ ok: true, state: 'severed' });
      }
      case 'setActive': {
        if (!body.linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });
        db.prepare('UPDATE memory_links SET cross_session_active = ?, cross_branch_active = ?, updated_at = ? WHERE id = ?')
          .run(body.crossSession ? 1 : 0, body.crossBranch ? 1 : 0, now, body.linkId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
