// SPDX-License-Identifier: Apache-2.0

import { getObserverConfig, setObserverConfig } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ config: getObserverConfig() });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'enabled required as boolean' }, { status: 400 });
  }
  setObserverConfig(body.enabled);
  return Response.json({ ok: true, enabled: body.enabled });
}
