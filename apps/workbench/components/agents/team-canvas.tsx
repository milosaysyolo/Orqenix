// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/agents/team-canvas.tsx
// Purpose: The Orchestrator team canvas. Renders agent nodes + edges as SVG.
//   Modes: select / connect / pan. In connect mode, dragging from a node port to
//   another creates an edge; an edge-type picker (spawn/tool/comm/data) appears.
//   Nodes come from the team graph; agents are dragged in from the Library.
// Rules: 'use client'. Controlled via props (nodes, edges, mode, onAddEdge,
//   onSelectNode, onMoveNode). Edge colors by type. Selected node = rust ring.
//   Keep it dependency-free (no flow lib).
// ============================================================================

'use client';

import * as React from 'react';

export interface TeamNode { id: string; name: string; type: 'agent' | 'subagent' | 'service'; x: number; y: number; }
export interface TeamEdge { id: string; from: string; to: string; type: 'spawn' | 'tool' | 'comm' | 'data'; }

const EDGE_COLOR: Record<TeamEdge['type'], string> = {
  spawn: 'var(--rust)', tool: 'var(--amber)', comm: 'var(--slate)', data: 'var(--teal)',
};
const NODE_COLOR: Record<TeamNode['type'], string> = {
  agent: 'var(--teal)', subagent: 'var(--plum)', service: 'var(--olive)',
};

export function TeamCanvas({
  nodes, edges, mode, selectedId, onSelectNode, onMoveNode, onAddEdge,
}: {
  nodes: TeamNode[]; edges: TeamEdge[]; mode: 'select' | 'connect' | 'pan';
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onAddEdge: (from: string, to: string, type: TeamEdge['type']) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [drag, setDrag] = React.useState<{ id: string; dx: number; dy: number } | null>(null);
  const [wire, setWire] = React.useState<{ from: string; x: number; y: number } | null>(null);
  const [picker, setPicker] = React.useState<{ from: string; to: string; x: number; y: number } | null>(null);

  const pt = (e: React.MouseEvent) => {
    const svg = svgRef.current!; const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 900, y: ((e.clientY - r.top) / r.height) * 560 };
  };

  function onNodeDown(e: React.MouseEvent, n: TeamNode) {
    e.stopPropagation();
    if (mode === 'connect') { setWire({ from: n.id, x: n.x, y: n.y }); return; }
    if (mode === 'select') { onSelectNode(n.id); const p = pt(e); setDrag({ id: n.id, dx: p.x - n.x, dy: p.y - n.y }); }
  }
  function onMove(e: React.MouseEvent) {
    if (drag) { const p = pt(e); onMoveNode(drag.id, p.x - drag.dx, p.y - drag.dy); }
    if (wire) { const p = pt(e); setWire({ ...wire, x: p.x, y: p.y }); }
  }
  function onNodeUp(e: React.MouseEvent, n: TeamNode) {
    e.stopPropagation();
    if (wire && wire.from !== n.id) { setPicker({ from: wire.from, to: n.id, x: n.x, y: n.y }); }
    setWire(null); setDrag(null);
  }

  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} viewBox="0 0 900 560" className="h-full w-full"
        onMouseMove={onMove} onMouseUp={() => { setDrag(null); setWire(null); }}>
        <defs>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--line)" />
          </pattern>
        </defs>
        <rect width="900" height="560" fill="url(#dots)" />

        {edges.map((ed) => {
          const a = nodes.find((n) => n.id === ed.from), b = nodes.find((n) => n.id === ed.to);
          if (!a || !b) return null;
          return (
            <g key={ed.id}>
              <path d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 30} ${b.x} ${b.y}`}
                fill="none" stroke={EDGE_COLOR[ed.type]} strokeWidth={2}
                strokeDasharray={ed.type === 'spawn' ? '6 4' : undefined} opacity={0.8} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 32} textAnchor="middle"
                className="font-mono" style={{ fontSize: 9, fill: EDGE_COLOR[ed.type] }}>{ed.type}</text>
            </g>
          );
        })}

        {wire && (() => {
          const a = nodes.find((n) => n.id === wire.from); if (!a) return null;
          return <path d={`M ${a.x} ${a.y} L ${wire.x} ${wire.y}`} stroke="var(--rust)" strokeWidth={2} strokeDasharray="4 4" fill="none" />;
        })()}

        {nodes.map((n) => {
          const sel = n.id === selectedId;
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer"
              onMouseDown={(e) => onNodeDown(e, n)} onMouseUp={(e) => onNodeUp(e, n)}>
              <rect x={-44} y={-20} width={88} height={40} rx={10} fill="var(--card)"
                stroke={NODE_COLOR[n.type]} strokeWidth={sel ? 3 : 2}
                style={sel ? { filter: `drop-shadow(0 0 8px ${NODE_COLOR[n.type]})` } : undefined} />
              <text textAnchor="middle" dy={-2} className="font-mono font-bold" style={{ fontSize: 10, fill: 'var(--ink)' }}>{n.name}</text>
              <text textAnchor="middle" dy={11} className="font-mono" style={{ fontSize: 8, fill: 'var(--dim)' }}>{n.type}</text>
              {mode === 'connect' && <circle cx={44} cy={0} r={4} fill={NODE_COLOR[n.type]} />}
            </g>
          );
        })}
      </svg>

      {picker && (
        <div className="absolute z-10 flex gap-1 rounded-[9px] border border-[var(--line2)] bg-[var(--card)] p-1 shadow"
          style={{ left: `${(picker.x / 900) * 100}%`, top: `${(picker.y / 560) * 100}%` }}>
          {(['spawn', 'tool', 'comm', 'data'] as TeamEdge['type'][]).map((t) => (
            <button key={t} onClick={() => { onAddEdge(picker.from, picker.to, t); setPicker(null); }}
              className="rounded px-2 py-0.5 font-mono text-[10px] font-bold" style={{ color: EDGE_COLOR[t] }}>{t}</button>
          ))}
          <button onClick={() => setPicker(null)} className="px-1 text-[var(--faint)]">&times;</button>
        </div>
      )}
    </div>
  );
}
