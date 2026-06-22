import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    let items: unknown[] = [];
    try {
      items = db.prepare('SELECT * FROM memory_library WHERE project_id = ? ORDER BY pinned_at DESC').all(rt.projectId);
    } catch { /* table */ }
    return NextResponse.json({ items }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { entryId: string; entryKb: string; collection?: string };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const dup = db.prepare('SELECT id FROM memory_library WHERE project_id = ? AND entry_id = ?').get(rt.projectId, body.entryId);
    if (!dup) {
      db.prepare('INSERT INTO memory_library (id, project_id, entry_id, entry_kb, pinned_at, collection) VALUES (?, ?, ?, ?, ?, ?)')
        .run(ulid(), rt.projectId, body.entryId, body.entryKb, new Date().toISOString(), body.collection ?? null);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const entryId = new URL(req.url).searchParams.get('entryId');
    if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });
    const rt = await getRuntime();
    rt.engine.getStore().db.prepare('DELETE FROM memory_library WHERE project_id = ? AND entry_id = ?').run(rt.projectId, entryId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
