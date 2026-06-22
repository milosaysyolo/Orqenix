// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/agents/agent-editor.tsx
// Purpose: The right-side .md editor panel (toggleable). Type dropdown
//   (agent/subagent), model, and a markdown textarea. Full CRUD: Create, Save
//   (update), Duplicate, Delete. POSTs to /api/agents. This is the opencode-/init
//   style authoring surface.
// Rules: 'use client'. Use lib/api. Confirm before delete. Save calls create or
//   update depending on whether the def has an id. onSaved refreshes the library.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Button } from '@/components/ui';
import { api } from '@/lib/api';
import type { AgentDef } from './agent-library';

const TEMPLATE = `name: new-agent
type: subagent
model: claude-3.5-sonnet
permissions: [memory.read:decision, command.execute:limited]
maxSteps: 5
maxWallTimeSec: 90

# System Prompt
Describe what this agent does. Subagents return results to the parent (absorbed to T1+T2).
`;

export function AgentEditor({
  def, onClose, onSaved,
}: { def: AgentDef | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const [md, setMd] = React.useState('');
  const [type, setType] = React.useState<'agent' | 'subagent'>('subagent');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const id = def && def !== 'new' ? def.id : null;

  React.useEffect(() => {
    if (def === 'new') { setMd(TEMPLATE); setType('subagent'); }
    else if (def) { setMd(def.markdown); setType(def.type); }
  }, [def]);

  if (!def) return null;

  function setTypeAndMd(t: 'agent' | 'subagent') {
    setType(t);
    setMd((m) => m.replace(/^type:\s*.+$/m, `type: ${t}`));
  }

  async function save() {
    setBusy(true); setNote(null);
    const res = id
      ? await api.post('/api/agents', { action: 'update', id, markdown: md })
      : await api.post('/api/agents', { action: 'create', markdown: md });
    setBusy(false);
    if (res.ok) { setNote('saved'); onSaved(); } else setNote(res.error ?? 'save failed');
  }
  async function duplicate() {
    setBusy(true);
    const dupMd = md.replace(/^name:\s*(.+)$/m, (_m, n) => `name: ${n}-copy`);
    const res = await api.post('/api/agents', { action: 'create', markdown: dupMd });
    setBusy(false);
    if (res.ok) onSaved();
  }
  async function del() {
    if (!id) { onClose(); return; }
    if (!confirm('Delete this agent definition?')) return;
    setBusy(true);
    const res = await api.post('/api/agents', { action: 'delete', id });
    setBusy(false);
    if (res.ok) { onSaved(); onClose(); }
  }

  return (
    <Panel
      title={id ? 'Edit Definition' : 'New Definition'}
      action={<button onClick={onClose} className="font-mono text-[10px] text-[var(--dim)] hover:text-[var(--ink)]">hide &#9656;</button>}
      className="h-full"
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="font-mono text-[10px] text-[var(--dim)]">Type</span>
            <select value={type} onChange={(e) => setTypeAndMd(e.target.value as 'agent' | 'subagent')}
              className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 font-mono text-[11px]">
              <option value="agent">agent</option>
              <option value="subagent">subagent</option>
            </select>
          </label>
        </div>

        <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={16} spellCheck={false}
          className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--rust)]" />

        {note && <div className="font-mono text-[10px] text-[var(--rust)]">{note}</div>}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={save} disabled={busy}>{id ? 'Save' : 'Create'}</Button>
          {id && <Button variant="outline" size="sm" onClick={duplicate} disabled={busy}>Duplicate</Button>}
          {id && <Button variant="danger" size="sm" onClick={del} disabled={busy}>Delete</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}
