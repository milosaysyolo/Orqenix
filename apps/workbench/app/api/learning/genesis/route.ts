// SPDX-License-Identifier: Apache-2.0
// Workbench , Skill Genesis API (generate skill from candidate)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { candidateId?: string; language?: string; nameOverride?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.candidateId) {
    return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 });
  }

  // D8.γ runtime:
  //   const { genesis } = buildSelfLearning(getMemoryEngine());
  //   const result = await genesis.generateFromCandidate({ candidateId, projectId, language, nameOverride });
  return NextResponse.json(
    {
      ok: true,
      candidateId: body.candidateId,
      note: 'SkillGenesis wires at runtime; generated skill is unverified (Anti-38)',
      verificationStatus: 'unverified',
    },
    { status: 200 }
  );
}
