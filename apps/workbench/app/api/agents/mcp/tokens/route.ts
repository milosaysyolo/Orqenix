// SPDX-License-Identifier: Apache-2.0

import { issueMCPToken } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { client?: unknown; scopes?: unknown };
  if (typeof body.client !== 'string') {
    return Response.json({ error: 'client required as string' }, { status: 400 });
  }
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((s): s is string => typeof s === 'string') : ['memory.read'];
  const token = issueMCPToken(body.client, scopes);
  return Response.json({ ok: true, token });
}
