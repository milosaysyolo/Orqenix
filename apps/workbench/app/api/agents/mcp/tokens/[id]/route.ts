// SPDX-License-Identifier: Apache-2.0

import { revokeMcpToken } from '@/lib/engine-init';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const ok = await revokeMcpToken(id);
  if (!ok) return Response.json({ error: 'token not found' }, { status: 404 });
  return Response.json({ ok: true });
}
