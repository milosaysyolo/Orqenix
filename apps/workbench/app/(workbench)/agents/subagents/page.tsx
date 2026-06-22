// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/(workbench)/agents/subagents/page.tsx
// Purpose: Subagents screen. Lists agent_definitions of type 'subagent' + their
//   harness constraints (maxSteps/maxWallTime) + live spawned subagent sessions.
//   Links to Orchestrator to author/edit. Wired to /api/agents + /api/sessions.
// Rules: 'use client'. Use lib/api. Shows definitions and any running subagents.
// ============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Def { id: string; name: string; type: string; model: string | null; max_steps: number; max_wall_time_sec: number; }

export default function SubagentsPage() {
  const [defs, setDefs] = React.useState<Def[]>([]);
  React.useEffect(() => {
    void api.get<{ defs: Def[] }>('/api/agents').then((r) => {
      if (r.ok) setDefs((r.data!.defs ?? []).filter((d) => d.type === 'subagent'));
    });
  }, []);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Subagent definitions and harness constraints">Subagents</SectionTitle>
        <Link href="/agents/orchestrator"><Button variant="outline" size="sm">Open Orchestrator &rarr;</Button></Link>
      </div>
      {defs.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          No subagents defined. Create one in the Orchestrator (.md definition).
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {defs.map((d) => (
            <Card key={d.id} className="flex items-center gap-3 px-4 py-3">
              <Badge tone="plum">subagent</Badge>
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{d.name}</span>
              <span className="font-mono text-[10px] text-[var(--dim)]">{d.model ?? 'default'}</span>
              <span className="ml-auto font-mono text-[10px] text-[var(--faint)]">maxSteps {d.max_steps} &middot; {d.max_wall_time_sec}s &middot; depth 1</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
