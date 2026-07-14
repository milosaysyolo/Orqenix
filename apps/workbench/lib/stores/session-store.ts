// SPDX-License-Identifier: Apache-2.0
// Workbench , real session store backed by the MemoryEngine `sessions` table.
// Engine-owned `sessions` lacks agent_name/progress/promoted_entries, so those
// live in a workbench-owned side table `workbench_session_meta`.

import type { Database } from 'better-sqlite3';
import type { Session } from '@/lib/demo-store';

export const PROJECT_ID = 'blake3:7f2ac8d1devworkbench00';
const DEFAULT_BRANCH = 'default-branch';

export function createSessionRow(
  db: Database,
  agentName: string,
  agentPlatform: string,
  parentSessionId?: string,
): Session {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (session_id, project_id, branch_id, parent_session_id, agent_platform, state, started_at, last_active_at)
     VALUES (@sid, @pid, @bid, @parent, @plat, 'active', @now, @now)`,
  ).run({ sid: id, pid: PROJECT_ID, bid: DEFAULT_BRANCH, parent: parentSessionId ?? null, plat: agentPlatform, now });
  db.prepare(
    `INSERT INTO workbench_session_meta (session_id, agent_name, progress, promoted_entries) VALUES (?, ?, 0, 0)`,
  ).run(id, agentName);
  return {
    session_id: id,
    agent_name: agentName,
    state: 'running',
    started_at: now,
    progress: 0,
    agent_platform: agentPlatform,
    parent_session_id: parentSessionId,
    promoted_entries: 0,
  };
}

export function listSessions(db: Database): Session[] {
  const rows = db
    .prepare(
      `SELECT s.session_id, s.agent_platform, s.state, s.started_at, s.parent_session_id,
              m.agent_name, m.progress, m.promoted_entries
       FROM sessions s LEFT JOIN workbench_session_meta m USING(session_id)
       WHERE s.state <> 'deleted'
       ORDER BY s.last_active_at DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    session_id: r.session_id as string,
    agent_name: (r.agent_name as string) ?? (r.agent_platform as string),
    state: (r.state === 'active' ? 'running' : r.state === 'paused' ? 'paused' : 'idle') as Session['state'],
    started_at: r.started_at as string,
    progress: (r.progress as number) ?? 0,
    agent_platform: r.agent_platform as string,
    parent_session_id: (r.parent_session_id as string | undefined) ?? undefined,
    promoted_entries: (r.promoted_entries as number) ?? 0,
  }));
}

export function resumeSessionRow(db: Database, id: string): boolean {
  const res = db
    .prepare(`UPDATE sessions SET state='active', last_active_at=? WHERE session_id=? AND state='paused'`)
    .run(new Date().toISOString(), id);
  return res.changes > 0;
}

export function pauseSessionRow(db: Database, id: string): boolean {
  const res = db
    .prepare(`UPDATE sessions SET state='paused', last_active_at=? WHERE session_id=? AND state='active'`)
    .run(new Date().toISOString(), id);
  return res.changes > 0;
}

export function abortSessionRow(db: Database, id: string): boolean {
  const res = db
    .prepare(`UPDATE sessions SET state='deleted', last_active_at=? WHERE session_id=?`)
    .run(new Date().toISOString(), id);
  return res.changes > 0;
}

export function promoteSessionRow(db: Database, id: string): number {
  const row = db
    .prepare(`UPDATE workbench_session_meta SET promoted_entries = promoted_entries + 1 WHERE session_id=? RETURNING promoted_entries`)
    .get(id) as { promoted_entries: number } | undefined;
  return row?.promoted_entries ?? 0;
}
