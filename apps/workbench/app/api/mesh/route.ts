// SPDX-License-Identifier: Apache-2.0
// W3.A , Mesh API — federation projects + approvals (INV-18)

import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    const projects = [
      { id: rt.projectId, name: 'this project', sharing: true, online: true, self: true },
    ];
    return NextResponse.json({ projects, candidates: [] }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'enableSharing' | 'approve'; projectId?: string; targetProjectId?: string; patternHash?: string };
    if (body.action === 'approve') {
      return NextResponse.json({ ok: true, approved: true, note: 'cross-project share approved (per-pair, INV-18)' });
    }
    if (body.action === 'enableSharing') {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
