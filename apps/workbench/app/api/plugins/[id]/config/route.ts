// SPDX-License-Identifier: Apache-2.0

import { getPlugins, updatePlugin } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const plugins = getPlugins();
  const plugin = plugins.find((p) => p.id === id);
  if (!plugin) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ config: plugin.config ?? '' });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const config = String(body.config ?? '');
    const updated = updatePlugin(id, { config });
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
