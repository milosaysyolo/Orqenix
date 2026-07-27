// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/memory-engine (BranchStore, demo-store fallback)

export const dynamic = 'force-dynamic';

import { getAllBranches, createBranchFromParent, promoteMemoryEntry } from '@/lib/engine-init';
import type { KbKind } from '@orqenix/memory-engine';

export async function GET(): Promise<Response> {
  try {
    const branches = await getAllBranches();
    return Response.json({ branches });
  } catch {
    return Response.json({ branches: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      parentBranchId?: unknown;
      newBranchName?: unknown;
      entryId?: unknown;
      targetBranchId?: unknown;
      kb?: string;
    };

    if (body.action === 'create') {
      if (typeof body.parentBranchId !== 'string' || typeof body.newBranchName !== 'string') {
        return Response.json(
          { error: 'parentBranchId and newBranchName required as strings' },
          { status: 400 }
        );
      }
      const result = await createBranchFromParent(body.parentBranchId, body.newBranchName);
      if (!result) return Response.json({ error: 'parent branch not found' }, { status: 404 });
      return Response.json({ ok: true, branchId: result.branchId, indexRowsCloned: 0 });
    }

    if (body.action === 'promote') {
      if (typeof body.entryId !== 'string' || typeof body.targetBranchId !== 'string') {
        return Response.json(
          { error: 'entryId and targetBranchId required as strings' },
          { status: 400 }
        );
      }
      const kb: KbKind = (body.kb as KbKind) ?? 'chat';
      const result = await promoteMemoryEntry(body.entryId, body.targetBranchId, kb);
      if (!result) return Response.json({ error: 'entry or branch not found' }, { status: 404 });
      return Response.json({ ok: true, newId: result.newId });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
}
