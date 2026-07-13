// SPDX-License-Identifier: Apache-2.0

import { togglePlugin } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const ok = togglePlugin(id);
  if (!ok) return Response.json({ error: 'plugin not found' }, { status: 404 });
  return Response.json({ ok: true });
}
