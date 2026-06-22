import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    const candidates = await rt.promoter.listForReview(rt.projectId, 50);
    return NextResponse.json({ candidates }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: string; candidateId: string; reviewedBy?: string; reason?: string };
    const valid = ['promote', 'promote_customize', 'reject', 'defer'];
    if (!valid.includes(body.action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 });
    const rt = await getRuntime();
    const result = await rt.promoter.review(
      { candidateId: body.candidateId, action: body.action as never, reviewedBy: body.reviewedBy ?? 'user', ...(body.reason ? { reason: body.reason } : {}) },
      rt.projectId
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}