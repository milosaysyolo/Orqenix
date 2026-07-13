// SPDX-License-Identifier: Apache-2.0

import { promoteToBranch } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

// Maps to MCP tool orqenix_promote_to_branch {entryId, kb, reason?}.
export async function POST(req: Request): Promise<Response> {
  let body: { entryId?: string; targetBranchId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!body.entryId || !body.targetBranchId) {
    return Response.json({ error: 'entryId and targetBranchId are required' }, { status: 400 });
  }
  const result = promoteToBranch(body.entryId, body.targetBranchId);
  if (!result) return Response.json({ error: 'entry or branch not found' }, { status: 404 });
  return Response.json({ ok: true, newId: result.newId });
}
