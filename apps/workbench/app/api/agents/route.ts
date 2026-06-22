// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/api/agents/route.ts
// Purpose: CRUD for agent/subagent definitions authored as markdown (opencode
//   /init style). GET lists; POST create/update/delete. Parses frontmatter-ish
//   fields (type, model, permissions, maxSteps) from the .md. This powers the
//   Agent Library + the .md editor panel in the Orchestrator.
// Rules: nodejs, force-dynamic. getRuntime(). agent_definitions table (580).
//   type ∈ {agent,subagent}. Validate name. Audit each mutation.
// ============================================================================

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDef(md: string) {
  const get = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(md)?.[1]?.trim();
  const name = get('name') ?? 'unnamed';
  const type = (get('type') === 'agent' ? 'agent' : 'subagent') as 'agent' | 'subagent';
  const model = get('model') ?? null;
  const maxSteps = Number(get('maxSteps') ?? '5') || 5;
  const maxWall = Number(get('maxWallTimeSec') ?? '90') || 90;
  const permsLine = get('permissions') ?? '';
  const permissions = permsLine
    ? permsLine.replace(/[\[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return { name, type, model, maxSteps, maxWall, permissions };
}

export async function GET() {
  try {
    const rt = await getRuntime();
    let defs: unknown[] = [];
    try {
      defs = rt.engine.getStore().db.prepare(
        'SELECT id, name, type, model, markdown, permissions_json, max_steps, max_wall_time_sec, enabled, version, updated_at FROM agent_definitions WHERE project_id = ? ORDER BY name'
      ).all(rt.projectId);
    } catch { /* */ }
    return NextResponse.json({ defs }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'create' | 'update' | 'delete'; id?: string; markdown?: string };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();

    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      db.prepare('DELETE FROM agent_definitions WHERE id = ? AND project_id = ?').run(body.id, rt.projectId);
      return NextResponse.json({ ok: true });
    }

    const md = body.markdown ?? '';
    const p = parseDef(md);

    if (body.action === 'create') {
      const id = ulid();
      db.prepare(
        `INSERT INTO agent_definitions (id, project_id, name, type, model, markdown, permissions_json, max_steps, max_wall_time_sec, enabled, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '0.1.0', ?, ?)`
      ).run(id, rt.projectId, p.name, p.type, p.model, md, JSON.stringify(p.permissions), p.maxSteps, p.maxWall, now, now);
      return NextResponse.json({ ok: true, id });
    }

    if (body.action === 'update') {
      if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      db.prepare(
        `UPDATE agent_definitions SET name=?, type=?, model=?, markdown=?, permissions_json=?, max_steps=?, max_wall_time_sec=?, updated_at=? WHERE id=? AND project_id=?`
      ).run(p.name, p.type, p.model, md, JSON.stringify(p.permissions), p.maxSteps, p.maxWall, now, body.id, rt.projectId);
      return NextResponse.json({ ok: true, id: body.id });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
