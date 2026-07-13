// SPDX-License-Identifier: Apache-2.0

import { queryEntries, type Tier, type KbKind, type MemoryLevel } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

const TIERS: Tier[] = ['T1', 'T2', 'T3', 'T4'];
const KBS: KbKind[] = ['chat', 'code', 'decision', 'lesson'];
const LEVELS: MemoryLevel[] = ['session', 'branch', 'project'];

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '100');
  const limit = Math.min(1000, Math.max(1, Number.isFinite(limitParam) ? limitParam : 100));
  const tier = url.searchParams.get('tier') as Tier | null;
  const kb = url.searchParams.get('kb') as KbKind | null;
  const branchId = url.searchParams.get('branchId') ?? undefined;
  const memoryLevel = url.searchParams.get('memoryLevel') as MemoryLevel | null;
  return Response.json({
    entries: queryEntries(limit, {
      tier: tier && TIERS.includes(tier) ? tier : undefined,
      kb: kb && KBS.includes(kb) ? kb : undefined,
      branchId,
      memoryLevel: memoryLevel && LEVELS.includes(memoryLevel) ? memoryLevel : undefined,
    }),
  });
}
