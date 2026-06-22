// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/api/agents/run/route.ts
// Purpose: Launch/pause/abort a team run. 'launch' creates a real session row +
//   subagent session rows for subagent nodes, emits session.started/subagent.
//   spawned events to the live bus (drives Agent Runner + Dashboard). pause/abort
//   update session state.
// Rules: nodejs, force-dynamic. getRuntime(). sessions table (580). Emit events
//   so the live network animates. Audit launches.
// ============================================================================

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { eventBus } from '@/lib/event-bus';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: 'launch' | 'pause' | 'abort'; sessionId?: string;
      teamName?: string; nodes?: Array<{ id: string; name: string; type: string }>;
    };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();

    if (body.action === 'launch') {
      const sessionId = ulid();
      const lead = body.nodes?.find((n) => n.type === 'agent') ?? body.nodes?.[0];
      db.prepare(
        `INSERT INTO sessions (session_id, project_id, branch_id, parent_session_id, agent_platform, agent_name, model, state, team_session_with, task, steps_done, steps_total, tokens, started_at, updated_at)
         VALUES (?, ?, 'blake3:main0000000000aabb', NULL, 'claude-code', ?, 'claude-3.5-sonnet', 'active', ?, ?, 0, 5, 0, ?, ?)`
      ).run(sessionId, rt.projectId, lead?.name ?? 'lead', body.teamName ?? 'team', `run ${body.teamName ?? 'team'}`, now, now);
      eventBus.emit({ kind: 'session.started', ts: now, payload: { sessionId, agent: lead?.name, team: body.teamName } });

      for (const n of (body.nodes ?? []).filter((x) => x.type === 'subagent')) {
        const sub = ulid();
        db.prepare(
          `INSERT INTO sessions (session_id, project_id, branch_id, parent_session_id, agent_platform, agent_name, model, state, task, steps_done, steps_total, tokens, started_at, updated_at)
           VALUES (?, ?, 'blake3:main0000000000aabb', ?, 'claude-code', ?, 'claude-3-haiku', 'active', ?, 0, 5, 0, ?, ?)`
        ).run(sub, rt.projectId, sessionId, n.name, `subagent ${n.name}`, now, now);
        eventBus.emit({ kind: 'subagent.spawned', ts: now, payload: { parent: sessionId, name: n.name } });
      }

      return NextResponse.json({ ok: true, sessionId });
    }

    if (body.action === 'pause' || body.action === 'abort') {
      if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
      const state = body.action === 'pause' ? 'paused' : 'error';
      db.prepare('UPDATE sessions SET state=?, updated_at=? WHERE session_id=?').run(state, now, body.sessionId);
      eventBus.emit({ kind: 'session.updated', ts: now, payload: { sessionId: body.sessionId, state } });
      return NextResponse.json({ ok: true, state });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
