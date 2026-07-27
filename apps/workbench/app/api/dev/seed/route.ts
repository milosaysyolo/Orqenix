// SPDX-License-Identifier: Apache-2.0

import { resetStore } from '@/lib/demo-store';
import { getMemory, seedWorkbench } from '@/lib/engine-init';
import { PROJECT_ID } from '@/lib/stores/session-store';
import { join } from 'node:path';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });

  // ponytail: real seed re-runs seedWorkbench (idempotent INSERT OR IGNORE); upgrade path: richer demo dataset
  const engine = await getMemory();
  if (engine) {
    const dbPath = process.env.ORQENIX_DB ?? join(process.cwd(), '.orqenix', 'memory.db');
    seedWorkbench(engine.getStore().db, PROJECT_ID);
    return Response.json({ ok: true, seeded: 'real', dbPath });
  }

  resetStore();
  return Response.json({ ok: true, seeded: { memoryEntries: 10, sessions: 3, plugins: 4, candidates: 3 } });
}
