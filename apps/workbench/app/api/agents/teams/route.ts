// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/api/agents/teams/route.ts
// Purpose: CRUD for orchestrated teams (the canvas: nodes + edges + config).
//   GET lists teams (and templates). POST save (create/update), saveTemplate,
//   delete. The canvas serializes nodes_json + edges_json. Powers the Orchestrator
//   save/load/template flow.
// Rules: nodejs, force-dynamic. getRuntime(). teams table (580). Enforce
//   max_subagent_depth = 1 default (Anti-36 single depth).
// ============================================================================

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { ulid } from '@orqenix/memory-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    let teams: unknown[] = [];
    try {
      teams = rt.engine.getStore().db.prepare(
        'SELECT id, name, template, strategy, max_subagent_depth, time_budget_sec, token_budget, nodes_json, edges_json, updated_at FROM teams WHERE project_id = ? ORDER BY updated_at DESC'
      ).all(rt.projectId);
    } catch { /* */ }
    return NextResponse.json({ teams }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action: 'save' | 'saveTemplate' | 'delete'; id?: string;
      name?: string; strategy?: string; nodes?: unknown[]; edges?: unknown[];
      maxDepth?: number; timeBudget?: number; tokenBudget?: number;
    };
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    const now = new Date().toISOString();

    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      db.prepare('DELETE FROM teams WHERE id = ? AND project_id = ?').run(body.id, rt.projectId);
      return NextResponse.json({ ok: true });
    }

    const isTemplate = body.action === 'saveTemplate' ? 1 : 0;
    const id = body.id ?? ulid();
    const exists = body.id ? db.prepare('SELECT id FROM teams WHERE id=?').get(body.id) : undefined;

    if (exists) {
      db.prepare(
        `UPDATE teams SET name=?, strategy=?, max_subagent_depth=?, time_budget_sec=?, token_budget=?, nodes_json=?, edges_json=?, updated_at=? WHERE id=?`
      ).run(body.name ?? 'Untitled Team', body.strategy ?? 'sequential', Math.min(body.maxDepth ?? 1, 1),
        body.timeBudget ?? 300, body.tokenBudget ?? 8192, JSON.stringify(body.nodes ?? []), JSON.stringify(body.edges ?? []), now, id);
    } else {
      db.prepare(
        `INSERT INTO teams (id, project_id, name, template, strategy, max_subagent_depth, time_budget_sec, token_budget, nodes_json, edges_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, rt.projectId, body.name ?? 'Untitled Team', isTemplate, body.strategy ?? 'sequential',
        Math.min(body.maxDepth ?? 1, 1), body.timeBudget ?? 300, body.tokenBudget ?? 8192,
        JSON.stringify(body.nodes ?? []), JSON.stringify(body.edges ?? []), now, now);
    }
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
