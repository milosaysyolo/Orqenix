// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/api/query/demo/route.ts
// Purpose: Runs a REAL hierarchy query through the engine AND emits query.stage
//   events to the bus so the Dashboard pipeline animates with real timing. Lets
//   you prove the live pipeline end-to-end before agents are wired (W3). POST a
//   {prompt} to trigger.
// Rules: nodejs, force-dynamic. Emit recall/distill/sign/rerank/inject/send with
//   metrics derived from the real query result. Use getRuntime().
// ============================================================================

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';
import { eventBus } from '@/lib/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { prompt?: string; branchId?: string; sessionId?: string };
  try { body = await req.json(); } catch { body = {}; }
  const prompt = body.prompt ?? 'how does our JWT refresh flow handle rotation?';

  const rt = await getRuntime();
  const rid = '#' + Math.floor(1000 + Math.random() * 9000);
  const emit = (stage: string, metric: string) =>
    eventBus.emit({ kind: 'query.stage', ts: new Date().toISOString(), payload: { stage, metric, prompt, rid } });

  // Stage 1: recall (real query against the engine).
  const t0 = Date.now();
  const result = await rt.engine.query({
    query: prompt,
    branchId: body.branchId ?? 'blake3:main0000000000aabb',
    ...(body.sessionId ? { sessionId: body.sessionId } : {}),
    limit: 20,
  });
  const recallMs = Date.now() - t0;
  emit('recall', `${result.results.length} hits · ${recallMs}ms`);

  // Stages 2-6 (timing model; real distill/sign wiring deepens in later phases).
  const totalIn = result.results.reduce((s, r) => s + (r.entry.content?.length ?? 0), 0);
  const tokIn = Math.round(totalIn / 4);
  const tokOut = Math.round(tokIn * 0.11);
  setTimeout(() => emit('distill', `${tokIn}→${tokOut} tok`), 120);
  setTimeout(() => emit('sign', `Ed25519 · ${result.results.length}`), 240);
  setTimeout(() => emit('rerank', `top ${(result.results[0]?.finalScore ?? 0).toFixed(2)}`), 360);
  setTimeout(() => emit('inject', `${tokOut}/8192`), 480);
  setTimeout(() => emit('send', 'ready'), 600);

  return NextResponse.json({ ok: true, rid, hits: result.results.length, levelsQueried: result.levelsQueried });
}
