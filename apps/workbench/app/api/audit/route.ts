import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const url = new URL(req.url);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);

    const entries = rt.engine.listAudit(offset, limit).map((e) => ({
      seq: e.seq, ts: e.ts, kind: e.kind,
      actor: (e as { actor?: { id?: string } }).actor?.id ?? 'system',
      hash: (e as { hash?: string }).hash ?? '',
      prevHash: (e as { prev_hash?: string }).prev_hash ?? '',
    }));
    const verification = rt.engine.verifyAuditChain();

    return NextResponse.json(
      { entries, verification: { valid: verification.valid, firstMismatchSeq: verification.firstMismatchSeq ?? null, entriesVerified: verification.entriesVerified ?? entries.length } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'verify' };
    const rt = await getRuntime();
    if (body.action === 'verify') {
      const v = rt.engine.verifyAuditChain();
      return NextResponse.json({ ok: true, valid: v.valid, firstMismatchSeq: v.firstMismatchSeq ?? null });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
