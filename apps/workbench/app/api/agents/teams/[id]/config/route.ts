// SPDX-License-Identifier: Apache-2.0

import { getAgentConfig, setAgentConfig } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const config = getAgentConfig(id);
  return Response.json({ config });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const config = String(body.config ?? '');
    setAgentConfig(id, config);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[agents/teams/[id]/config]', e);
    return Response.json({ error: 'Failed to update team config' }, { status: 400 });
  }
}
