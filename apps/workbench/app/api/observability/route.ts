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

    const kbCounts: Record<string, number> = {};
    let total = 0;
    for (const [kb, table] of Object.entries(KB_TABLE)) {
      try {
        const r = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE project_id=?`).get(rt.projectId) as { c: number };
        kbCounts[kb] = r.c; total += r.c;
      } catch { kbCounts[kb] = 0; }
    }

    const count = (sql: string, ...p: unknown[]) => {
      try { return (db.prepare(sql).get(...p) as { c: number }).c; } catch { return 0; }
    };
    const sessions = {
      active: count("SELECT COUNT(*) AS c FROM sessions WHERE state='active'"),
      total: count('SELECT COUNT(*) AS c FROM sessions'),
    };
    const plugins = count('SELECT COUNT(*) AS c FROM installed_plugins');
    const candidates = count("SELECT COUNT(*) AS c FROM instinct_candidates WHERE status='detected'");
    const auditLen = rt.engine.listAudit(0, 1000000).length;

    const t0 = performance.now();
    try { await rt.engine.query({ query: 'health', branchId: 'blake3:main0000000000aabb', limit: 5 }); } catch { /* */ }
    const queryMs = Math.round((performance.now() - t0) * 100) / 100;

    return NextResponse.json({
      total, kbCounts, sessions, plugins, candidates, auditLen,
      latency: { queryMs, sloMs: 300, pass: queryMs < 300 },
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
