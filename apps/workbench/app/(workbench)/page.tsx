// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/(workbench)/page.tsx
// Purpose: The Dashboard route. Server component that fetches /api/dashboard data
//   then renders the hero ContextPipeline + MatrixViz + stats + right column
//   (AgentActivity, MeshStatus, RecentLearning). This is the default landing
//   screen, matching the approved mockup.
// Rules: Server component fetches with no-store. Pass real data to client viz.
//   Use the SectionTitle + Stat primitives. Keep the warm editorial layout.
// ============================================================================

import { headers } from 'next/headers';
import { SectionTitle, Stat } from '@/components/ui';
import { ContextPipeline } from '@/components/dashboard/context-pipeline';
import { MatrixViz } from '@/components/dashboard/matrix-viz';
import { AgentActivity } from '@/components/dashboard/agent-activity';
import { MeshStatus } from '@/components/dashboard/mesh-status';
import { RecentLearning } from '@/components/dashboard/recent-learning';

export const dynamic = 'force-dynamic';

interface DashboardData {
  projectId: string;
  matrix: Record<string, Record<string, number>>;
  totalEntries: number;
  sessions: { active: number; total: number };
  auditValid: boolean;
  recentAudit: Array<{ seq: number; ts: string; kind: string }>;
  learning: Array<{ id: string; name: string | null; impact: number; successRate: number; count: number }>;
}

async function getData(): Promise<DashboardData | null> {
  try {
    const h = await headers();
    const host = h.get('host') ?? '127.0.0.1:27420';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const res = await fetch(`${proto}://${host}/api/dashboard`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as DashboardData;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const data = await getData();
  const matrix = data?.matrix ?? { T1: {}, T2: {}, T3: {}, T4: {} };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <SectionTitle sub="context is where quality is won or lost">Live Context Assembly</SectionTitle>

      {/* Stat row */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Memory Entries" value={(data?.totalEntries ?? 0).toLocaleString()} accent="teal" />
        <Stat label="Active Sessions" value={data?.sessions.active ?? 0} accent="rust" />
        <Stat label="Total Sessions" value={data?.sessions.total ?? 0} />
        <Stat label="Audit Chain" value={data?.auditValid ? 'valid ✓' : '—'} accent={data?.auditValid ? 'olive' : 'neutral'} />
        <Stat label="Candidates" value={data?.learning.length ?? 0} accent="amber" />
      </div>

      {/* Hero pipeline + matrix */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <ContextPipeline />
          <MatrixViz matrix={matrix} />
        </div>
        <div className="space-y-4">
          <AgentActivity />
          <MeshStatus peers={2} />
          <RecentLearning items={data?.learning ?? []} />
        </div>
      </div>
    </div>
  );
}
