// SPDX-License-Identifier: Apache-2.0

import { getEntry } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(entry);
}
