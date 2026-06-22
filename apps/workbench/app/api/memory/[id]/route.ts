import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KB_TABLE: Record<string, string> = {
  chat: 'chat_entries', code: 'code_entries', decision: 'decision_entries', lesson: 'lesson_entries',
};

async function loadEntry(rt: Awaited<ReturnType<typeof getRuntime>>, kb: string, id: string) {
  const db = rt.engine.getStore().db;
  const table = KB_TABLE[kb];
  if (!table) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const content = rt.engine.fetchContent(kb as never, id) ?? (row.content as string | null);
  let link: Record<string, unknown> | null = null;
  try {
    link = (db.prepare('SELECT * FROM memory_links WHERE entry_id = ? ORDER BY updated_at DESC LIMIT 1').get(id) as never) ?? null;
  } catch { /* */ }
  return { ...row, content, link };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const kb = new URL(req.url).searchParams.get('kb') ?? 'decision';
    const rt = await getRuntime();
    const entry = await loadEntry(rt, kb, id);
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    return NextResponse.json({ entry }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { action: string; kb: string; branchId?: string; sessionId?: string };
    const rt = await getRuntime();

    switch (body.action) {
      case 'promote': {
        await rt.engine.promote({
          entryId: id, kb: body.kb as never, from: 'session', to: 'branch',
          ...(body.sessionId ? { fromSessionId: body.sessionId } : {}),
          fromBranchId: body.branchId ?? 'blake3:main0000000000aabb',
          reason: 'promoted from Workbench',
        });
        return NextResponse.json({ ok: true, action: 'promote' });
      }
      case 'export': {
        const entry = await loadEntry(rt, body.kb, id);
        return NextResponse.json({ ok: true, action: 'export', entry });
      }
      case 'clone': {
        const entry = await loadEntry(rt, body.kb, id);
        if (!entry) return NextResponse.json({ error: 'not found' }, { status: 404 });
        const cloned = await rt.engine.write({
          kb: body.kb as never, content: String(entry.content ?? ''),
          branch_id: body.branchId ?? 'blake3:main0000000000aabb', memory_level: 'branch',
        });
        return NextResponse.json({ ok: true, action: 'clone', newId: cloned.id });
      }
      default:
        return NextResponse.json({ error: `Unknown action ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const kb = new URL(req.url).searchParams.get('kb') ?? 'decision';
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const table = KB_TABLE[kb];
    if (!table) return NextResponse.json({ error: 'bad kb' }, { status: 400 });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
