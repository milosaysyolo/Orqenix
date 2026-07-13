// SPDX-License-Identifier: Apache-2.0

import { linkEntries } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  if (!body.from || !body.to) return Response.json({ error: 'from and to required' }, { status: 400 });
  const ok = linkEntries(body.from, body.to);
  return Response.json({ ok });
}
