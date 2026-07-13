// SPDX-License-Identifier: Apache-2.0
// Phase 3: wired to @orqenix/memory-engine (MemoryEngine.promote)

export const dynamic = 'force-dynamic';

import { promoteMemoryEntry } from '@/lib/engine-init';
import type { KbKind } from '@orqenix/memory-engine';

export async function POST(req: Request): Promise<Response> {
  let body: { entryId?: string; targetBranchId?: string; kb?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!body.entryId || !body.targetBranchId) {
    return Response.json(
      { error: 'entryId and targetBranchId are required' },
      { status: 400 }
    );
  }

  const kb: KbKind = (body.kb as KbKind) ?? 'chat';

  try {
    const result = await promoteMemoryEntry(body.entryId, body.targetBranchId, kb);
    if (!result) {
      return Response.json({ error: 'entry or branch not found' }, { status: 404 });
    }
    return Response.json({ ok: true, newId: result.newId });
  } catch (err) {
    console.error('[memory/promote/POST]', err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
