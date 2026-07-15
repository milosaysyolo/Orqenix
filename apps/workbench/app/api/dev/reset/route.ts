// SPDX-License-Identifier: Apache-2.0

import { resetStore } from '@/lib/demo-store';
import { getMemory } from '@/lib/engine-init';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });

  // ponytail: real reset deletes ORQENIX_DB + clears singletons; upgrade path: graceful online wipe of tables
  const engine = await getMemory();
  if (engine) {
    const dbPath = process.env.ORQENIX_DB ?? join(process.cwd(), '.orqenix', 'memory.db');
    try { engine.close(); } catch {}
    globalThis.__orqenixMemory = undefined;
    globalThis.__orqenixInitPromise = undefined;
    globalThis.__orqenixSettings = undefined;
    globalThis.__orqenixPromoter = undefined;
    globalThis.__orqenixObserver = undefined;
    globalThis.__orqenixDetector = undefined;
    globalThis.__orqenixSkillGenesis = undefined;
    globalThis.__orqenixMarketplace = undefined;
    globalThis.__orqenixPluginRegistry = undefined;
    globalThis.__orqenixPluginLifecycle = undefined;
    rmSync(dbPath, { force: true });
    rmSync(dbPath + '-wal', { force: true });
    rmSync(dbPath + '-shm', { force: true });
    return Response.json({ ok: true, cleared: 'real', dbPath });
  }

  resetStore();
  return Response.json({ ok: true, cleared: 14 });
}
