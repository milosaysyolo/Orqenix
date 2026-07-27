// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// MEMORY GRAPH — React Flow canvas (Canvas pillar). Auto radial layout (project
// centre → KB ring → entry ring), custom themed nodes, minimap + zoom/pan.
// Select a node to open its detail; double-click an entry to pin it.
// ============================================================================

'use client';

import * as React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes, type FlowNodeData } from './flow-nodes';
import type { GraphNode, GraphEdge, KbKind } from '@/lib/demo-store';

const KB_COLOR: Record<KbKind, string> = { chat: 'var(--amber)', code: 'var(--teal)', decision: 'var(--plum)', lesson: 'var(--slate)' };
const TYPE_COLOR: Record<string, string> = { project: 'var(--teal)', branch: 'var(--plum)', kb: 'var(--rust)', entry: 'var(--slate)' };

function layout(nodes: GraphNode[]): { [id: string]: { x: number; y: number } } {
  const W = 900, H = 620, cx = W / 2, cy = H / 2;
  const pos: { [id: string]: { x: number; y: number } } = {};
  pos['project'] = { x: cx, y: cy };
  const ring1 = nodes.filter((n) => n.type === 'kb' || n.type === 'branch');
  ring1.forEach((n, i) => {
    const a = (i / Math.max(1, ring1.length)) * Math.PI * 2;
    pos[n.id] = { x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 130 };
  });
  const entries = nodes.filter((n) => n.type === 'entry');
  // Group entries under their KB so the outer ring clusters by colour.
  entries.forEach((n, i) => {
    const a = (i / Math.max(1, entries.length)) * Math.PI * 2 + 0.3;
    pos[n.id] = { x: cx + Math.cos(a) * 280, y: cy + Math.sin(a) * 230 };
  });
  return pos;
}

function GraphInner({
  nodes: g, edges: ge, selectedId, onSelect, onPin,
}: {
  nodes: GraphNode[]; edges: GraphEdge[]; selectedId: string | null;
  onSelect: (id: string) => void; onPin: (n: GraphNode) => void;
}) {
  const pos = React.useMemo(() => layout(g), [g]);

  const initialNodes: Node<FlowNodeData>[] = React.useMemo(() => g.map((n) => {
    const p = pos[n.id] ?? { x: 0, y: 0 };
    const color = n.type === 'entry' && n.kb ? KB_COLOR[n.kb] : TYPE_COLOR[n.type] ?? 'var(--dim)';
    return {
      id: n.id,
      type: n.type === 'project' ? 'rect' : 'circle',
      position: p,
      data: { label: n.label, color, badge: n.count != null ? String(n.count) : n.tier, shape: 'circle' },
    };
  }), [g, pos]);

  const initialEdges: Edge[] = React.useMemo(() => ge.map((e, i) => {
    const linked = e.type === 'linked';
    return {
      id: `e_${i}`,
      source: e.from, target: e.to, type: 'token',
      data: {
        color: linked ? 'var(--rust)' : 'var(--line2)',
        width: linked ? 2.2 : 1.2,
        opacity: linked ? 0.9 : 0.5,
        label: e.label,
      },
    };
  }), [ge]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    // Reflect selection as a glow on the node data.
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selectedId } })));
  }, [selectedId, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, n) => onSelect(n.id)}
      onNodeDoubleClick={(_, n) => {
        if (n.id.startsWith('entry:')) {
          const gn = g.find((x) => x.id === n.id);
          if (gn) onPin(gn);
        }
      }}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.3}
      maxZoom={2}
    >
      <Background gap={22} size={1} color="var(--line)" />
      <MiniMap pannable zoomable nodeColor={(n) => (n.data as FlowNodeData).color} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function MemoryGraph(props: {
  nodes: GraphNode[]; edges: GraphEdge[]; selectedId: string | null;
  onSelect: (id: string) => void; onPin: (n: GraphNode) => void;
}) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
