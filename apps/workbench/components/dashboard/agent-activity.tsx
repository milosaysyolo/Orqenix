// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/agent-activity.tsx
// Purpose: Right-column live Agent Activity card on the Dashboard. Shows running
//   agents + subagent links, driven by SSE 'subagent.spawned'/'session.updated'.
//   Links to /agents/runner. Falls back to a calm empty state.
// Rules: 'use client'. Compact rows: agent · branch · running step x/y · elapsed.
// ============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Panel, Badge, LiveDot } from '@/components/ui';
import { useLiveEvents } from '@/lib/use-live-events';

interface AgentRow { id: string; platform: string; branch: string; step: string; elapsed: string; subagent?: string; }

export function AgentActivity({ initial }: { initial?: AgentRow[] }) {
  const { events } = useLiveEvents(['subagent.spawned', 'session.updated']);
  const [rows, setRows] = React.useState<AgentRow[]>(
    initial ?? [
      { id: 'claude-code', platform: 'claude-code', branch: 'jwt-rotation', step: 'step 3/5', elapsed: '42s', subagent: 'test-runner' },
    ]
  );

  React.useEffect(() => {
    // In W3 this maps live session events into rows; for now it reflects spawns.
    const spawns = events.filter((e) => e.kind === 'subagent.spawned');
    if (spawns.length === 0) return;
    // (kept minimal in W2; full session wiring in W3)
  }, [events]);

  return (
    <Panel
      title="Agent Activity"
      action={<Link href="/agents/runner">open runner →</Link>}
    >
      {rows.length === 0 ? (
        <div className="py-6 text-center font-mono text-[11px] text-[var(--faint)]">No active agents.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-2.5">
              <div className="flex items-center gap-2">
                <LiveDot on />
                <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{r.platform}</span>
                <Badge tone="plum">{r.branch}</Badge>
                <span className="ml-auto font-mono text-[10px] text-[var(--dim)]">{r.elapsed}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-[var(--dim)]">
                <span className="text-[var(--olive)]">{r.step}</span>
                {r.subagent && (
                  <>
                    <span className="text-[var(--faint)]">↳</span>
                    <Badge tone="amber">{r.subagent}</Badge>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
