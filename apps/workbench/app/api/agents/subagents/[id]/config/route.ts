// SPDX-License-Identifier: Apache-2.0

import { getSubagents, updateSubagent } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const subagents = getSubagents();
  const sub = subagents.find((s) => s.id === id);
  if (!sub) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ config: sub.config ?? '' });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const config = String(body.config ?? '');
    const updated = updateSubagent(id, { config });
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[agents/subagents/[id]/config]', e);
    return Response.json({ error: 'Failed to update subagent config' }, { status: 400 });
  }
}
