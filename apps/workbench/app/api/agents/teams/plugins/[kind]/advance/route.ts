// SPDX-License-Identifier: Apache-2.0

import { advancePluginLifecycle } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }): Promise<Response> {
  const { kind } = await params;
  const next = advancePluginLifecycle(kind);
  if (!next) return Response.json({ error: 'already at final stage' }, { status: 400 });
  return Response.json({ ok: true, kind, stage: next });
}
