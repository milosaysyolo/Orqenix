import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KB_TABLE: Record<string, string> = {
  chat: 'chat_entries', code: 'code_entries', decision: 'decision_entries', lesson: 'lesson_entries',
};

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const url = new URL(req.url);
    const kbFilter = url.searchParams.get('kb');
    const tier = url.searchParams.get('tier');
    const level = url.searchParams.get('level');
    const branch = url.searchParams.get('branch');
    const session = url.searchParams.get('session');
    const search = url.searchParams.get('q');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);

    const kbs = kbFilter ? [kbFilter] : Object.keys(KB_TABLE);
    const rows: Array<Record<string, unknown>> = [];

    for (const kb of kbs) {
      const table = KB_TABLE[kb];
      if (!table) continue;
      const conds: string[] = ['project_id = @projectId'];
      const params: Record<string, unknown> = { projectId: rt.projectId };
      if (tier) { conds.push('tier = @tier'); params.tier = tier; }
      if (level) { conds.push('memory_level = @level'); params.level = level; }
      if (branch) { conds.push('branch_id = @branch'); params.branch = branch; }
      if (session) { conds.push('session_id = @session'); params.session = session; }
      if (search) { conds.push('content LIKE @q'); params.q = `%${search}%`; }
      try {
        const r = db
          .prepare(`SELECT id, hash, tier, content, branch_id, session_id, memory_level, created_at
                    FROM ${table} WHERE ${conds.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`)
          .all(params) as Array<Record<string, unknown>>;
        for (const row of r) rows.push({ ...row, kb });
      } catch { /* table may not exist yet */ }
    }

    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return NextResponse.json(
      { entries: rows.slice(0, limit) },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
