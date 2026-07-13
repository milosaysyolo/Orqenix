// SPDX-License-Identifier: Apache-2.0

import { toggleSkill } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const ok = toggleSkill(id);
  if (!ok) return Response.json({ error: 'skill not found' }, { status: 404 });
  return Response.json({ ok: true });
}
