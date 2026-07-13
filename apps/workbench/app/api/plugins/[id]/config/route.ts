// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/plugin-core (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getPluginConfig, updatePluginConfig } from '@/lib/engine-init';

export async function GET(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const config = await getPluginConfig(id);
  return Response.json({ config });
}

export async function PUT(
  req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const config = String(body.config ?? '');
    const ok = await updatePluginConfig(id, config);
    if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
