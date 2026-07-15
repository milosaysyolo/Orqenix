// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/skill-genesis (demo-store fallback)

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { generateSkillFromCandidate } from '@/lib/engine-init';

export async function POST(req: Request): Promise<Response> {
  let body: { candidateId?: string; language?: string; nameOverride?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.candidateId) {
    return Response.json({ error: 'Missing candidateId' }, { status: 400 });
  }

  try {
    const result = await generateSkillFromCandidate(body.candidateId, body.language, body.nameOverride);
    return Response.json({
      ok: true,
      candidateId: body.candidateId,
      skillName: result.skillName,
      verificationStatus: result.verificationStatus,
    });
  } catch (err) {
    console.error('[learning/genesis]', err);
    return Response.json({ error: 'Failed to record genesis' }, { status: 500 });
  }
}
