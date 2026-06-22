// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/recent-learning.tsx
// Purpose: Dashboard card listing the top detected learning candidates with
//   impact scores, linking to /learning. Data comes from /api/dashboard.learning.
// Rules: 'use client'. Each row: pattern name + impact badge + success%. Link to
//   Learning Hub for review.
// ============================================================================

'use client';

import Link from 'next/link';
import { Panel, Badge } from '@/components/ui';

interface Candidate { id: string; name: string | null; impact: number; successRate: number; count: number; }

export function RecentLearning({ items }: { items: Candidate[] }) {
  return (
    <Panel
      title="Recent Learning"
      action={<Link href="/learning">review →</Link>}
    >
      {items.length === 0 ? (
        <div className="py-6 text-center font-mono text-[11px] text-[var(--faint)]">No candidate patterns yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/learning?id=${c.id}`}
              className="flex items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-2.5 transition-colors hover:border-[var(--rust)]"
            >
              <span className="text-[var(--amber)]">✦</span>
              <span className="flex-1 truncate font-mono text-[11.5px] text-[var(--ink)]">{c.name ?? '(unnamed)'}</span>
              <span className="font-mono text-[10px] text-[var(--dim)]">{Math.round(c.successRate * 100)}%</span>
              <Badge tone="rust">{c.impact.toFixed(1)}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
