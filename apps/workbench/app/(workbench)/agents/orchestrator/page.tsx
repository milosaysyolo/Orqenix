// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/app/(workbench)/agents/orchestrator/page.tsx
// Purpose: The Agent Orchestrator screen. Composes: toolbar (team name, template
//   save/load, Run Team, mode toggle select/connect/pan, Editor toggle), Agent
//   Library (left), Team Canvas (center), and the Agent Editor (right, toggleable).
//   Wires team save/load (/api/agents/teams) + agent defs (/api/agents) + launch
//   (/api/agents/run). Full save/load/delete/reset flows.
// Rules: 'use client'. Hold team graph state (nodes/edges/config). Add agent from
//   library &rarr; node. Connect edges via canvas. Save persists. Run launches.
// ============================================================================

'use client';

import * as React from 'react';
import { SectionTitle, Card, Button } from '@/components/ui';
import { TeamCanvas, type TeamNode, type TeamEdge } from '@/components/agents/team-canvas';
import { AgentLibrary, type AgentDef } from '@/components/agents/agent-library';
import { AgentEditor } from '@/components/agents/agent-editor';
import { api } from '@/lib/api';

export default function OrchestratorPage() {
  const [teamName, setTeamName] = React.useState('Untitled Team');
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [nodes, setNodes] = React.useState<TeamNode[]>([]);
  const [edges, setEdges] = React.useState<TeamEdge[]>([]);
  const [mode, setMode] = React.useState<'select' | 'connect' | 'pan'>('select');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(true);
  const [editing, setEditing] = React.useState<AgentDef | 'new' | null>(null);
  const [libRefresh, setLibRefresh] = React.useState(0);
  const [note, setNote] = React.useState<string | null>(null);

  function addAgent(d: AgentDef) {
    const n: TeamNode = {
      id: `node-${d.id}-${nodes.length}`, name: d.name,
      type: d.type === 'agent' ? 'agent' : 'subagent',
      x: 200 + (nodes.length % 4) * 150, y: 150 + Math.floor(nodes.length / 4) * 120,
    };
    setNodes((prev) => [...prev, n]);
  }
  function addEdge(from: string, to: string, type: TeamEdge['type']) {
    setEdges((prev) => [...prev, { id: `e-${prev.length}`, from, to, type }]);
  }
  function moveNode(id: string, x: number, y: number) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }

  async function saveTeam(asTemplate = false) {
    setNote(null);
    const res = await api.post<{ ok: boolean; id: string }>('/api/agents/teams', {
      action: asTemplate ? 'saveTemplate' : 'save',
      id: teamId, name: teamName, strategy: 'sequential', nodes, edges, maxDepth: 1,
    });
    if (res.ok) { setTeamId(res.data!.id); setNote(asTemplate ? 'template saved' : 'team saved'); }
    else setNote(res.error ?? 'save failed');
  }
  function resetCanvas() {
    if (!confirm('Reset the canvas? Unsaved changes are lost.')) return;
    setNodes([]); setEdges([]); setSelected(null); setTeamId(null); setTeamName('Untitled Team');
  }
  async function runTeam() {
    const res = await api.post<{ ok: boolean; sessionId?: string }>('/api/agents/run', {
      action: 'launch', teamName, nodes, edges,
    });
    setNote(res.ok ? `launched &middot; session ${res.data?.sessionId}` : (res.error ?? 'launch failed'));
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Compose, connect, and run agent teams">Agent Orchestrator</SectionTitle>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[12px] outline-none focus:border-[var(--rust)]" />
        <Button variant="outline" size="sm" onClick={() => saveTeam(false)}>Save</Button>
        <Button variant="outline" size="sm" onClick={() => saveTeam(true)}>Save as Template</Button>
        <Button variant="ghost" size="sm" onClick={resetCanvas}>Reset</Button>
        <div className="inline-flex rounded-[9px] border border-[var(--line2)] p-0.5">
          {(['select', 'connect', 'pan'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={'rounded-[7px] px-2.5 py-1 font-mono text-[11px] capitalize ' +
                (mode === m ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)]')}>{m}</button>
          ))}
        </div>
        <label className="ml-2 flex items-center gap-1.5 font-mono text-[10px] text-[var(--dim)]">
          Editor
          <button onClick={() => setEditorOpen((v) => !v)} className="relative h-4 w-7 rounded-full"
            style={{ background: editorOpen ? 'var(--rust)' : 'var(--line2)' }}>
            <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: editorOpen ? 14 : 2 }} />
          </button>
        </label>
        <Button variant="primary" size="sm" className="ml-auto" onClick={runTeam}>&#9654; Run Team</Button>
      </div>
      {note && <div className="mt-1 font-mono text-[10px] text-[var(--dim)]">{note}</div>}

      <div className={'mt-4 grid gap-4 ' + (editorOpen ? 'grid-cols-[210px_1fr_340px]' : 'grid-cols-[210px_1fr]')}>
        <AgentLibrary refreshKey={libRefresh} onAdd={addAgent} onEdit={(d) => { setEditing(d); setEditorOpen(true); }} onNew={() => { setEditing('new'); setEditorOpen(true); }} />

        <Card className="min-h-[560px] p-2">
          <TeamCanvas nodes={nodes} edges={edges} mode={mode} selectedId={selected}
            onSelectNode={setSelected} onMoveNode={moveNode} onAddEdge={addEdge} />
        </Card>

        {editorOpen && (
          <AgentEditor def={editing} onClose={() => setEditing(null)} onSaved={() => setLibRefresh((k) => k + 1)} />
        )}
      </div>
    </div>
  );
}
