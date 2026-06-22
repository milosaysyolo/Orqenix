import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const rt = await getRuntime();
    const url = new URL(req.url);
    const scope = (url.searchParams.get('scope') ?? 'project') as 'project' | 'branch' | 'session';
    const id = url.searchParams.get('id') ?? rt.projectId;
    const config = rt.observer.getConfig(scope, id === 'current' ? rt.projectId : id);
    return NextResponse.json({ config }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { scope: 'project' | 'branch' | 'session'; id: string; enabled: boolean };
    const rt = await getRuntime();
    rt.observer.setConfig(body.scope, body.id === 'current' ? rt.projectId : body.id, { enabled: body.enabled });
    return NextResponse.json({ ok: true, enabled: body.enabled });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}