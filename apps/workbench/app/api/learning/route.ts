import { getCandidates, setCandidateStatus } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const candidates = getCandidates().map((c) => ({
    id: c.id,
    patternName: c.name,
    patternDescription: `Pattern "${c.name}" observed ${c.count} times with ${Math.round(c.successRate * 100)}% success rate.`,
    occurrenceCount: c.count,
    successRate: c.successRate,
    impactScore: c.impact,
    estTimeSavedPerWeekMin: Math.round(c.impact * 30),
    status: c.status,
  }));
  return Response.json({ candidates });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { action?: string; candidateId?: string };
  if (body.action === 'promote' || body.action === 'promote_customize' || body.action === 'reject') {
    const status = body.action === 'promote' || body.action === 'promote_customize' ? 'approved' : 'rejected';
    const ok = setCandidateStatus(body.candidateId ?? '', status);
    if (!ok) return Response.json({ error: 'candidate not found' }, { status: 404 });
    const result: Record<string, unknown> = { ok: true };
    if (body.action === 'promote' || body.action === 'promote_customize') {
      result.generatedSkillName = `${body.candidateId}-skill`;
      if (body.action === 'promote_customize') result.openBuilder = true;
    }
    return Response.json(result);
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
