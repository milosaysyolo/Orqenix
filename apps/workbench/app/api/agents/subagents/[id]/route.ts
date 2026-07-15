import { getSubagents, updateSubagent, deleteSubagent } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const agents = getSubagents();
  const agent = agents.find((a) => a.id === id);
  if (!agent) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ subagent: agent });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = updateSubagent(id, body);
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ subagent: updated });
  } catch (e) {
    console.error('[agents/subagents/[id]]', e);
    return Response.json({ error: 'Failed to update subagent' }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = deleteSubagent(id);
  if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
