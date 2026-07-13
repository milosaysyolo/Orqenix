// SPDX-License-Identifier: Apache-2.0

import { getBranches, createBranch, promoteToBranch } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const branches = getBranches().map((b) => ({
    ...b,
    created_at: b.created_at,
  }));
  return Response.json({ branches });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    parentBranchId?: unknown;
    newBranchName?: unknown;
    entryId?: unknown;
    targetBranchId?: unknown;
  };
  if (body.action === 'create') {
    if (typeof body.parentBranchId !== 'string' || typeof body.newBranchName !== 'string') {
      return Response.json({ error: 'parentBranchId and newBranchName required as strings' }, { status: 400 });
    }
    const result = createBranch(body.parentBranchId, body.newBranchName);
    if (!result) return Response.json({ error: 'parent branch not found' }, { status: 404 });
    return Response.json({ ok: true, branchId: result.branchId, indexRowsCloned: result.indexRowsCloned });
  }
  if (body.action === 'promote') {
    if (typeof body.entryId !== 'string' || typeof body.targetBranchId !== 'string') {
      return Response.json({ error: 'entryId and targetBranchId required as strings' }, { status: 400 });
    }
    const result = promoteToBranch(body.entryId, body.targetBranchId);
    if (!result) return Response.json({ error: 'entry or branch not found' }, { status: 404 });
    return Response.json({ ok: true, newId: result.newId });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
