// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/instinct-promoter (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getVerificationCandidates } from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const candidates = await getVerificationCandidates();
    return Response.json({
      verifications: candidates.map((c) => ({
        id: c.id,
        name: c.patternName,
        status: 'pending',
        successRate: c.successRate,
        replayCount: c.occurrenceCount,
      })),
    });
  } catch {
    return Response.json({ verifications: [] });
  }
}
