// SPDX-License-Identifier: Apache-2.0
// Workbench , Verification API (verify a generated skill)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { skillName?: string; skillVersion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.skillName) {
    return NextResponse.json({ error: 'Missing skillName' }, { status: 400 });
  }

  // D8.γ runtime:
  //   const engine = getMemoryEngine();
  //   const executor: SkillExecutor = { replay: (i) => skillRuntime.invoke(...) };
  //   const loop = new VerificationLoop({ db: engine.getStore().db, executor });
  //   const result = await loop.verify({ skillName, skillVersion, derivedFromObservations, projectId });
  return NextResponse.json(
    {
      ok: true,
      skillName: body.skillName,
      newStatus: 'unverified',
      canDefaultEnable: false,
      note: 'VerificationLoop wires at runtime; only verified skills default-enable (Anti-38)',
    },
    { status: 200 }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const skillName = url.searchParams.get('skill');
  if (!skillName) {
    return NextResponse.json({ error: 'Missing skill param' }, { status: 400 });
  }
  // D8.γ: return loop.getHistory(skillName)
  return NextResponse.json({ skillName, runs: [] }, { status: 200 });
}
