// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// TEAM CANVAS — React Flow orchestrator workspace (Canvas + Interaction pillars).
//   - Custom nodes: AgentNode (rect), SubagentNode (rect), ServiceNode (rect)
//   - Custom edges: SpawnEdge, ToolEdge, CommEdge, DataEdge (colour-coded)
//   - Drag from AgentLibrary → drop on canvas = add new node
//   - Edge type picker: floating toolbar appears when you release a connection
//   - Snap-to-grid toggle, multi-select (shift+click / rubber-band)
//   - Keyboard: Delete=remove, Ctrl+Z=undo, Ctrl-Shift+Z=redo, Ctrl+A=select all
//   - Undo/redo via useHistory hook (snapshots node+edge arrays)
// ============================================================================

'use client';

import * as React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes, type FlowNodeData, RectNode } from './flow-nodes';
import { useHistory } from '@/lib/history';
import type { TeamNode, TeamEdge } from '@/lib/demo-store';

const NODE_COLOR: Record<TeamNode['type'], string> = { agent: 'var(--teal)', subagent: 'var(--plum)', service: 'var(--olive)' };
const EDGE_COLOR: Record<TeamEdge['type'], string> = { spawn: 'var(--rust)', tool: 'var(--amber)', comm: 'var(--slate)', data: 'var(--teal)' };

const SNAP_SIZE = 22;

function snapToGrid(pos: XYPosition): XYPosition {
  return {
    x: Math.round(pos.x / SNAP_SIZE) * SNAP_SIZE,
    y: Math.round(pos.y / SNAP_SIZE) * SNAP_SIZE,
  };
}

// Convert the store's TeamNode/TeamEdge into React Flow's Node/Edge format.
function toFlowNodes(teamNodes: TeamNode[]): Node<FlowNodeData>[] {
  return teamNodes.map((n) => ({
    id: n.id,
    type: 'rect',
    position: { x: n.x, y: n.y },
    data: { label: n.name, sub: n.type, color: NODE_COLOR[n.type], shape: 'rect' as const },
    selected: false,
  }));
}

function toFlowEdges(teamEdges: TeamEdge[]): Edge[] {
  return teamEdges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'token',
    data: { color: EDGE_COLOR[e.type], width: e.type === 'spawn' ? 2.4 : 1.8, opacity: 0.8, label: e.type },
  }));
}

interface PendingConnection { source: string; target: string; x: number; y: number; }

/** Convert a FlowNode back to a TeamNode for the parent. */
function toTeamNode(n: Node<FlowNodeData>): TeamNode {
  return {
    id: n.id,
    name: n.data.label,
    type: (n.data.sub as TeamNode['type']) ?? 'agent',
    x: n.position.x,
    y: n.position.y,
  };
}

/** Convert a FlowEdge back to a TeamEdge for the parent. */
function toTeamEdge(e: Edge): TeamEdge {
  return {
    id: e.id,
    from: e.source,
    to: e.target,
    type: (e.data?.label as TeamEdge['type']) ?? 'comm',
  };
}

function CanvasInner({ initialNodes, initialEdges, onChange }: {
  initialNodes: TeamNode[];
  initialEdges: TeamEdge[];
  onChange?: (nodes: TeamNode[], edges: TeamEdge[]) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(initialEdges));
  const [snap, setSnap] = React.useState(true);
  const [pending, setPending] = React.useState<PendingConnection | null>(null);
  const [connecting, setConnecting] = React.useState(false);

  // Undo/redo history of node+edge arrays.
  const { commit, undo, redo, can } = useHistory<{ nodes: Node<FlowNodeData>[]; edges: Edge[] }>({ nodes: toFlowNodes(initialNodes), edges: toFlowEdges(initialEdges) }, 80);

  // Keep `present` synced with the actual nodes/edges. Commit on meaningful changes.
  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  React.useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  React.useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Report canvas edits to parent with debounce (300ms) to avoid spam.
  const debouncedOnChange = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!onChange) return;
    if (debouncedOnChange.current) clearTimeout(debouncedOnChange.current);
    debouncedOnChange.current = setTimeout(() => {
      onChange(nodes.map(toTeamNode), edges.map(toTeamEdge));
    }, 300);
    return () => { if (debouncedOnChange.current) clearTimeout(debouncedOnChange.current); };
  }, [nodes, edges, onChange]);

  const commitSnapshot = React.useCallback(() => {
    commit({ nodes: nodesRef.current, edges: edgesRef.current });
  }, [commit]);

  // When undo/redo fires, apply the snapshot back.
  React.useEffect(() => {
    // We compare by node count as a proxy — the real compare is the identity check inside useHistory.
  }, [undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- DRAG FROM LIBRARY → DROP ON CANVAS ----
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = React.useState<ReturnType<typeof Object> | null>(null);

  const onDragOver = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const data = JSON.parse(raw) as { id: string; type: TeamNode['type']; name: string };
    const position = snap ? snapToGrid(rfInstance!.screenToFlowPosition({ x: e.clientX, y: e.clientY })) : rfInstance!.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: Node<FlowNodeData> = {
      id: data.id, type: 'rect', position,
      data: { label: data.name, sub: data.type, color: NODE_COLOR[data.type], shape: 'rect' },
    };
    setNodes((nds) => [...nds, newNode]);
    // Defer the commit to let React batch the update.
    setTimeout(commitSnapshot, 0);
  }, [rfInstance, snap, setNodes, commitSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- CONNECTION HANDLING (edge type picker) ----
  const onConnectStart = React.useCallback(() => { setConnecting(true); setPending(null); }, []);
  const onConnectEnd = React.useCallback(() => { setConnecting(false); }, []);

  const onConnect = React.useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    // Show the edge-type picker instead of immediately adding the edge.
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (sourceNode && targetNode) {
      setPending({
        source: connection.source,
        target: connection.target,
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
      });
    }
  }, [nodes]);

  function pickEdgeType(type: TeamEdge['type']) {
    if (!pending) return;
    const id = `e_${pending.source}_${pending.target}`;
    const edge: Edge = {
      id, source: pending.source, target: pending.target, type: 'token',
      data: { color: EDGE_COLOR[type], width: type === 'spawn' ? 2.4 : 1.8, opacity: 0.8, label: type },
    };
    setEdges((eds) => addEdge(edge, eds));
    setPending(null);
    setTimeout(commitSnapshot, 0);
  }

  // ---- KEYBOARD SHORTCUTS ----
  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Delete selected nodes/edges.
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((ed) => !ed.selected));
      setTimeout(commitSnapshot, 0);
      return;
    }
    // Ctrl+Z = undo, Ctrl+Shift+Z = redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const snapshot = undo();
      if (snapshot) { setNodes(snapshot.nodes); setEdges(snapshot.edges); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      const snapshot = redo();
      if (snapshot) { setNodes(snapshot.nodes); setEdges(snapshot.edges); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Z') {
      e.preventDefault();
      const snapshot = redo();
      if (snapshot) { setNodes(snapshot.nodes); setEdges(snapshot.edges); }
      return;
    }
    // Ctrl+A = select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
      return;
    }
    // Escape = deselect all + dismiss picker
    if (e.key === 'Escape') {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setPending(null);
    }
  }, [setNodes, setEdges, undo, redo, commitSnapshot]);

  // Empty state: shown when canvas has zero nodes.
  const showEmptyState = nodes.length === 0;

  return (
    <div className="relative h-full w-full" ref={reactFlowWrapper}>
      {/* Empty state overlay */}
      {showEmptyState && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[13px] border-2 border-dashed border-[var(--line2)] bg-[color-mix(in_oklab,var(--paper)_60%,transparent)] backdrop-blur-[1px]">
          <div className="font-mono text-[32px] text-[var(--faint)] opacity-40">{'\u229E'}</div>
          <div className="font-mono text-[13px] font-bold text-[var(--dim)]">Drag agents onto the canvas</div>
          <div className="font-mono text-[10px] text-[var(--faint)]">Select an agent type from the sidebar and drag it here</div>
          <div className="mt-2 flex gap-3">
            <span className="rounded-[6px] bg-[color-mix(in_oklab,var(--teal)_12%,transparent)] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[var(--teal)]">Connect nodes to create edges</span>
            <span className="rounded-[6px] bg-[color-mix(in_oklab,var(--plum)_12%,transparent)] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[var(--plum)]">Ctrl+Z to undo</span>
            <span className="rounded-[6px] bg-[color-mix(in_oklab,var(--rust)_12%,transparent)] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[var(--rust)]">Del to remove</span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          // Commit on drag-stop (position changes).
          const posChanged = changes.some((c) => c.type === 'position' && 'position' in c);
          if (posChanged) setTimeout(commitSnapshot, 100);
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={setRfInstance}
        onKeyDown={onKeyDown}
        snapToGrid={snap}
        snapGrid={[SNAP_SIZE, SNAP_SIZE]}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null} // we handle Delete ourselves (for undo support)
        multiSelectionKeyCode="Shift"
        minZoom={0.2}
        maxZoom={3}
        className="rounded-[13px]"
        style={{ background: 'var(--paper)' }}
      >
        <Background gap={22} size={1} color="var(--line)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => (n.data as FlowNodeData).color} />
      </ReactFlow>

      {/* EDGE TYPE PICKER (floating toolbar) */}
      {pending && (
        <div className="absolute z-30 animate-scale-in rounded-[9px] border border-[var(--line2)] bg-[var(--card)] p-1.5 shadow-[0_8px_22px_rgba(35,36,31,0.12)]">
          <div className="mb-1 font-mono text-[9px] font-bold uppercase text-[var(--faint)]">edge type</div>
          <div className="flex gap-1">
            {(['spawn', 'tool', 'comm', 'data'] as TeamEdge['type'][]).map((t) => (
              <button
                key={t}
                onClick={() => pickEdgeType(t)}
                className="rounded-[6px] px-2 py-1 font-mono text-[10px] font-bold transition-colors hover:bg-[var(--paper2)]"
                style={{ color: EDGE_COLOR[t] }}
              >{t}</button>
            ))}
            <button onClick={() => setPending(null)} className="px-1 font-mono text-[11px] text-[var(--faint)] hover:text-[var(--ink)]">{'\u00D7'}</button>
          </div>
        </div>
      )}

      {/* TOOLBAR (snap toggle + undo/redo) */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-[9px] border border-[var(--line2)] bg-[var(--card)] p-1 shadow">
        <button
          onClick={() => setSnap((s) => !s)}
          className={'rounded-[6px] px-2 py-1 font-mono text-[10px] font-bold ' + (snap ? 'text-[var(--rust)]' : 'text-[var(--faint)]')}
          title="Toggle snap-to-grid"
        >grid {snap ? 'on' : 'off'}</button>
        <button onClick={() => { const s = undo(); if (s) { setNodes(s.nodes); setEdges(s.edges); } }}
          disabled={!can.undo}
          className="rounded-[6px] px-2 py-1 font-mono text-[10px] font-bold text-[var(--dim)] hover:text-[var(--ink)] disabled:opacity-30"
          title="Undo (Ctrl+Z)">{'\u21B6'} undo</button>
        <button onClick={() => { const s = redo(); if (s) { setNodes(s.nodes); setEdges(s.edges); } }}
          disabled={!can.redo}
          className="rounded-[6px] px-2 py-1 font-mono text-[10px] font-bold text-[var(--dim)] hover:text-[var(--ink)] disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)">redo {'\u21B7'}</button>
      </div>
    </div>
  );
}

export function TeamCanvas({ initialNodes, initialEdges, onChange }: {
  initialNodes: TeamNode[];
  initialEdges: TeamEdge[];
  onChange?: (nodes: TeamNode[], edges: TeamEdge[]) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner initialNodes={initialNodes} initialEdges={initialEdges} onChange={onChange} />
    </ReactFlowProvider>
  );
}
