import { getPlugins, updatePlugin, deletePlugin } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const plugins = getPlugins();
  const plugin = plugins.find((p) => p.id === id);
  if (!plugin) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ plugin });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = updatePlugin(id, body);
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ plugin: updated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = deletePlugin(id);
  if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
