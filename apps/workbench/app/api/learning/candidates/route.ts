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
  const body = (await req.json().catch(() => ({}))) as { candidateId?: string; action?: string };
  if (body.action === 'promote' || body.action === 'reject' || body.action === 'defer') {
    const status = body.action === 'promote' ? 'approved' : body.action === 'reject' ? 'rejected' : 'pending';
    const ok = setCandidateStatus(body.candidateId ?? '', status);
    if (!ok) return Response.json({ error: 'candidate not found' }, { status: 404 });
    return Response.json({ ok: true, generatedSkillName: body.action === 'promote' ? `${body.candidateId}-skill` : undefined });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
