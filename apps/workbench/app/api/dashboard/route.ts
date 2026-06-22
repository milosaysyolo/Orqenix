// SPDX-License-Identifier: Apache-2.0

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

    // Matrix: cell counts per KB x tier.
    const matrix: Record<string, Record<string, number>> = { T1: {}, T2: {}, T3: {}, T4: {} };
    let totalEntries = 0;
    for (const [kb, table] of Object.entries(KB_TABLE)) {
      try {
        const rows = db
          .prepare(`SELECT tier, COUNT(*) AS c FROM ${table} WHERE project_id = ? GROUP BY tier`)
          .all(rt.projectId) as Array<{ tier: string; c: number }> | undefined;
        for (const r of rows ?? []) {
          const tierRow = matrix[r.tier];
          if (tierRow) tierRow[kb] = r.c;
          totalEntries += r.c;
        }
      } catch {
        /* table may be empty */
      }
    }

    // Sessions counts.
    let activeSessions = 0, totalSessions = 0;
    try {
      const a = db.prepare("SELECT COUNT(*) AS c FROM sessions WHERE state='active'").get() as { c: number };
      const t = db.prepare('SELECT COUNT(*) AS c FROM sessions').get() as { c: number };
      activeSessions = a.c; totalSessions = t.c;
    } catch { /* sessions table */ }

    // Recent audit + learning candidates.
    const recentAudit = rt.engine.listAudit(0, 8).slice(-8).reverse();
    const candidates = rt.detector.getCandidateStore().list(rt.projectId, 'detected', 5);

    return NextResponse.json(
      {
        projectId: rt.projectId,
        matrix,
        totalEntries,
        sessions: { active: activeSessions, total: totalSessions },
        auditValid: rt.engine.verifyAuditChain().valid,
        recentAudit: recentAudit.map((e) => ({ seq: e.seq, ts: e.ts, kind: e.kind })),
        learning: candidates.map((c) => ({
          id: c.id, name: c.pattern_name, impact: c.impact_score, successRate: c.success_rate, count: c.observation_count,
        })),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
