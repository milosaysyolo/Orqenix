// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/plugin-core (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getPluginById, updatePluginItem, deletePluginItem } from '@/lib/engine-init';

export async function GET(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const plugin = await getPluginById(id);
  if (!plugin) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ plugin });
}

export async function PUT(
  req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await updatePluginItem(id, body);
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ plugin: updated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = await deletePluginItem(id);
  if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
