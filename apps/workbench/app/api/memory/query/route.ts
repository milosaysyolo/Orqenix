// SPDX-License-Identifier: Apache-2.0
// Phase 3: wired to @orqenix/memory-engine with demo-store fallback

export const dynamic = 'force-dynamic';

import { queryMemory } from '@/lib/engine-init';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '100');
  const limit = Math.min(1000, Math.max(1, Number.isFinite(limitParam) ? limitParam : 100));
  const tier = url.searchParams.get('tier') ?? undefined;
  const kb = url.searchParams.get('kb') ?? undefined;
  const branchId = url.searchParams.get('branchId') ?? undefined;
  const memoryLevel = url.searchParams.get('memoryLevel') ?? undefined;

  try {
    const entries = await queryMemory(limit, { tier, kb, branchId, memoryLevel });
    return Response.json({ entries });
  } catch (err) {
    console.error('[memory/query/GET]', err);
    return Response.json({ entries: [] });
  }
}
