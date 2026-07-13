import { NextRequest, NextResponse } from 'next/server';
import { runSync, getSyncResults } from '@/lib/demo-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ results: getSyncResults() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body?.mode === 'dry-run' || body?.mode === 'verify' || body?.mode === 'sync' ? body.mode : 'sync';
    const result = runSync(mode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
}
