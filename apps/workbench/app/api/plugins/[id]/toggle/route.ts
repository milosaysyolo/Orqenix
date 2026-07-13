// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/plugin-core (demo-store fallback)

export const dynamic = 'force-dynamic';

import { togglePluginItem } from '@/lib/engine-init';

export async function POST(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = await togglePluginItem(id);
  if (!ok) return Response.json({ error: 'plugin not found' }, { status: 404 });
  return Response.json({ ok: true });
}
