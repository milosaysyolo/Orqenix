// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired through engine-init (demo-store fallback)

export const dynamic = 'force-dynamic';

import { toggleSkillItem } from '@/lib/engine-init';

export async function POST(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = await toggleSkillItem(id);
  if (!ok) return Response.json({ error: 'skill not found' }, { status: 404 });
  return Response.json({ ok: true });
}
