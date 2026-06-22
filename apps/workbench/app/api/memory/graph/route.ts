import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KB_TABLE: Record<string, string> = {
  chat: 'chat_entries', code: 'code_entries', decision: 'decision_entries', lesson: 'lesson_entries',
};

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;

    const nodes: Array<{ id: string; label: string; type: string; kb?: string; tier?: string; count?: number }> = [];
    const edges: Array<{ from: string; to: string; type: string; label?: string }> = [];

    nodes.push({ id: 'project', label: 'project', type: 'project', count: 0 });

    try {
      const branches = db.prepare('SELECT branch_id, branch_name FROM branches WHERE project_id = ? LIMIT 12')
        .all(rt.projectId) as Array<{ branch_id: string; branch_name: string }>;
      for (const b of branches) {
        nodes.push({ id: `branch:${b.branch_id}`, label: b.branch_name, type: 'branch' });
        edges.push({ from: 'project', to: `branch:${b.branch_id}`, type: 'contains' });
      }
    } catch { /* */ }

    for (const [kb, table] of Object.entries(KB_TABLE)) {
      try {
        const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE project_id = ?`).get(rt.projectId) as { c: number };
        nodes.push({ id: `kb:${kb}`, label: `${kb}KB`, type: 'kb', kb, count: row.c });
        edges.push({ from: 'project', to: `kb:${kb}`, type: 'has' });
      } catch { /* */ }
    }

    for (const [kb, table] of Object.entries(KB_TABLE)) {
      try {
        const rows = db.prepare(
          `SELECT id, tier, content, promoted_from_session_id, cloned_from_branch_id
           FROM ${table} WHERE project_id = ? ORDER BY created_at DESC LIMIT 6`
        ).all(rt.projectId) as Array<Record<string, unknown>>;
        for (const e of rows) {
          const nid = `entry:${e.id}`;
          nodes.push({ id: nid, label: String(e.content ?? e.id).slice(0, 28), type: 'entry', kb, tier: String(e.tier) });
          edges.push({ from: `kb:${kb}`, to: nid, type: 'member' });
          if (e.promoted_from_session_id) edges.push({ from: nid, to: 'project', type: 'promoted', label: 'promoted' });
        }
      } catch { /* */ }
    }

    try {
      const links = db.prepare(
        "SELECT entry_id, entry_kb, from_scope, to_scope FROM memory_links WHERE project_id = ? AND state='active' LIMIT 30"
      ).all(rt.projectId) as Array<{ entry_id: string; from_scope: string; to_scope: string }>;
      for (const l of links) {
        edges.push({ from: `entry:${l.entry_id}`, to: l.to_scope, type: 'linked', label: 'linked \u00b7 active' });
      }
    } catch { /* memory_links table */ }

    return NextResponse.json({ nodes, edges }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
