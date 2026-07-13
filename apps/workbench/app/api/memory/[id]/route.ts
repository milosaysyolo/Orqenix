// SPDX-License-Identifier: Apache-2.0
// Phase 3: wired to @orqenix/memory-engine (SqliteStore.getEntry)

export const dynamic = 'force-dynamic';

import { getMemoryEntry } from '@/lib/engine-init';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const entry = await getMemoryEntry(id);
    if (!entry) {
      return Response.json({ error: 'not found' }, { status: 404 });
    }
    return Response.json(entry);
  } catch (err) {
    console.error('[memory/[id]/GET]', err);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}
