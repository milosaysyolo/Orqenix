// SPDX-License-Identifier: Apache-2.0
// AGENT PROMPT
// File: apps/workbench/app/api/sessions/route.ts
// Purpose: Sessions management. GET lists sessions; POST pause/resume/abort/clone.

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { eventBus } from '@/lib/event-bus';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const stateFilter = new URL(req.url).searchParams.get('state');
    let rows: Array<Record<string, unknown>> = [];
    try {
      const sql = stateFilter && stateFilter !== 'all'
        ? 'SELECT * FROM sessions WHERE project_id=? AND state=? ORDER BY started_at DESC'
        : 'SELECT * FROM sessions WHERE project_id=? ORDER BY started_at DESC';
      rows = (stateFilter && stateFilter !== 'all'
        ? db.prepare(sql).all(rt.projectId, stateFilter)
        : db.prepare(sql).all(rt.projectId)) as Array<Record<string, unknown>>;
    } catch { /* */ }
    const parents = rows.filter((r) => !r.parent_session_id);
    const children = rows.filter((r) => r.parent_session_id);
    const result = parents.map((p) => ({
      ...p,
      subagents: children.filter((c) => c.parent_session_id === p.session_id),
    }));
    return NextResponse.json({ sessions: result, counts: {
      active: rows.filter((r) => r.state === 'active').length,
      paused: rows.filter((r) => r.state === 'paused').length,
      total: rows.length,
    } }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'pause' | 'resume' | 'abort' | 'clone'; sessionId: string };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();

    if (body.action === 'clone') {
      const src = db.prepare('SELECT * FROM sessions WHERE session_id=?').get(body.sessionId) as Record<string, unknown> | undefined;
      if (!src) return NextResponse.json({ error: 'not found' }, { status: 404 });
      const newId = ulid();
      db.prepare(
        `INSERT INTO sessions (session_id, project_id, branch_id, parent_session_id, agent_platform, agent_name, model, state, team_session_with, task, steps_done, steps_total, tokens, started_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 'active', ?, ?, 0, ?, 0, ?, ?)`
      ).run(newId, rt.projectId, src.branch_id, src.agent_platform, src.agent_name, src.model, src.team_session_with, `clone of ${String(src.task)}`, src.steps_total, now, now);
      return NextResponse.json({ ok: true, newSessionId: newId });
    }

    const stateMap = { pause: 'paused', resume: 'active', abort: 'error' } as const;
    const newState = stateMap[body.action];
    db.prepare('UPDATE sessions SET state=?, updated_at=? WHERE session_id=?').run(newState, now, body.sessionId);
    eventBus.emit({ kind: 'session.updated', ts: now, payload: { sessionId: body.sessionId, state: newState } });
    return NextResponse.json({ ok: true, state: newState });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
