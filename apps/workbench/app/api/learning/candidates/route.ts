// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/instinct-promoter (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getLearningCandidates, reviewCandidate } from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const candidates = await getLearningCandidates();
    return Response.json({ candidates });
  } catch (err) {
    console.error('[learning/candidates/GET]', err);
    return Response.json({ candidates: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as { candidateId?: string; action?: string };
    if (!body.candidateId || !body.action) {
      return Response.json({ error: 'candidateId and action required' }, { status: 400 });
    }
    if (!['promote', 'reject', 'defer'].includes(body.action)) {
      return Response.json({ error: 'unknown action' }, { status: 400 });
    }
    const result = await reviewCandidate(body.candidateId, body.action);
    if (!result.ok) return Response.json({ error: 'candidate not found' }, { status: 404 });
    return Response.json({
      ok: true,
      generatedSkillName: body.action === 'promote' ? result.generatedSkillName : undefined,
    });
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
}
