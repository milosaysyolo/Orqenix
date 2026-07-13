// SPDX-License-Identifier: Apache-2.0

import { headers } from 'next/headers';
import { DashboardWrapper } from '@/components/dashboard/dashboard-wrapper';
import type { LearningCandidate } from '@/lib/demo-store';

export const dynamic = 'force-dynamic';

interface DashboardData {
  projectId: string;
  matrix: Record<string, Record<string, number>>;
  totalEntries: number;
  sessions: { active: number; total: number };
  auditValid: boolean;
  learning: LearningCandidate[];
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

  return <DashboardWrapper initialData={data} initialMatrix={matrix} />;
}
