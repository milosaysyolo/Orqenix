// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/agents/agent-library.tsx
// Purpose: The Orchestrator's Agent Library rail. Lists agent_definitions (from
//   /api/agents). Click a card to add it to the canvas (onAdd). Select to open in
//   the editor. "+ New Agent" creates a blank definition. Search + type filter.
// Rules: 'use client'. Use lib/api. Cards show name + type tag + model.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

export interface AgentDef { id: string; name: string; type: 'agent' | 'subagent'; model: string | null; markdown: string; }

export function AgentLibrary({
  refreshKey, onAdd, onEdit, onNew,
}: { refreshKey: number; onAdd: (d: AgentDef) => void; onEdit: (d: AgentDef) => void; onNew: () => void }) {
  const [defs, setDefs] = React.useState<AgentDef[]>([]);
  const [q, setQ] = React.useState('');

  const load = React.useCallback(async () => {
    const res = await api.get<{ defs: AgentDef[] }>('/api/agents');
    if (res.ok) setDefs(res.data!.defs);
  }, []);
  React.useEffect(() => { void load(); }, [load, refreshKey]);

  const filtered = defs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Panel title="Agent Library" action={<Button size="sm" variant="primary" onClick={onNew}>+ New</Button>} className="h-full">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search agents&hellip;"
        className="mb-2 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono text-[11px] outline-none focus:border-[var(--rust)]" />
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="py-6 text-center font-mono text-[10.5px] text-[var(--faint)]">No agents yet. Create one &rarr;</div>
        ) : filtered.map((d) => (
          <div key={d.id} className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-2">
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(d)} className="flex-1 text-left font-mono text-[11.5px] font-bold text-[var(--ink)]">{d.name}</button>
              <Badge tone={d.type === 'agent' ? 'teal' : 'plum'}>{d.type}</Badge>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-[9.5px] text-[var(--dim)]">{d.model ?? 'default model'}</span>
              <button onClick={() => onAdd(d)} className="font-mono text-[10px] text-[var(--rust)] hover:underline">+ add to canvas</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
