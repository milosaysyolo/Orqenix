// SPDX-License-Identifier: Apache-2.0

import { getSubagentInvocations, spawnSubagent } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ invocations: getSubagentInvocations() });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { subagentId?: unknown };
  if (typeof body.subagentId !== 'string') {
    return Response.json({ error: 'subagentId required as string' }, { status: 400 });
  }
  const result = spawnSubagent(body.subagentId);
  if (!result) {
    return Response.json({ error: 'subagent not found' }, { status: 404 });
  }
  return Response.json({ ok: true, invocation: result });
}
