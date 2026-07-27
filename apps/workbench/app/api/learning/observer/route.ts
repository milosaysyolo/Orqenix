// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/self-learning-observer (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getObserverConfigData, setObserverConfigData } from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const config = await getObserverConfigData();
    return Response.json({ config });
  } catch {
    return Response.json({ config: { enabled: true, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 } });
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== 'boolean') {
    return Response.json({ error: 'enabled required as boolean' }, { status: 400 });
  }
  await setObserverConfigData({ enabled: body.enabled });
  return Response.json({ ok: true, enabled: body.enabled });
}
