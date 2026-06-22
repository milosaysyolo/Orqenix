// SPDX-License-Identifier: Apache-2.0
// AGENT PROMPT
// File: apps/workbench/app/api/agents/tick/route.ts
// Purpose: Advances active sessions by one step (real DB update) + emits agent.message events.

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { eventBus } from '@/lib/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();
    const active = db.prepare("SELECT session_id, agent_name, steps_done, steps_total FROM sessions WHERE project_id=? AND state='active'")
      .all(rt.projectId) as Array<{ session_id: string; agent_name: string; steps_done: number; steps_total: number }>;

    for (const s of active) {
      const next = s.steps_done + 1;
      if (next >= s.steps_total) {
        db.prepare("UPDATE sessions SET steps_done=?, state='completed', updated_at=? WHERE session_id=?").run(s.steps_total, now, s.session_id);
        eventBus.emit({ kind: 'session.updated', ts: now, payload: { sessionId: s.session_id, state: 'completed' } });
      } else {
        db.prepare('UPDATE sessions SET steps_done=?, tokens=tokens+128, updated_at=? WHERE session_id=?').run(next, now, s.session_id);
        eventBus.emit({ kind: 'agent.message', ts: now, payload: { sessionId: s.session_id, agent: s.agent_name, step: next } });
      }
    }
    return NextResponse.json({ ok: true, advanced: active.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
