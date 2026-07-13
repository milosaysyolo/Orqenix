// SPDX-License-Identifier: Apache-2.0

import { Panel, Badge } from '@/components/ui';
import type { LearningCandidate } from '@/lib/demo-store';

export function RecentLearning({ items }: { items: LearningCandidate[] }) {
  return (
    <Panel title="Recent Learning" action={<Badge tone="amber">{items.length} candidates</Badge>}>
      <div className="space-y-2">
        {items.length === 0 && <div className="py-3 text-center font-mono text-data-xs text-[var(--faint)]">no candidates yet</div>}
        {items.map((c) => (
          <div key={c.id} className="rounded-sm border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="truncate font-mono text-data-base font-bold text-[var(--ink)]">{c.name}</span>
              <Badge tone={c.status === 'approved' ? 'olive' : c.status === 'rejected' ? 'rust' : 'amber'}>{c.status}</Badge>
            </div>
            <div className="mt-1 flex gap-3 font-mono text-[9.5px] text-[var(--dim)]">
              <span>impact {Math.round(c.impact * 100)}%</span>
              <span>success {Math.round(c.successRate * 100)}%</span>
              <span>{c.count} runs</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
