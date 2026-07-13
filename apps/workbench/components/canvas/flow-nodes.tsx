// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// FLOW NODES — custom React Flow node/edge components themed to the editorial
// tokens. Shared by the Memory Graph and Team Canvas.
// ============================================================================

'use client';

import * as React from 'react';
import { Handle, Position, type NodeProps, type EdgeProps } from '@xyflow/react';

export interface FlowNodeData {
  label: string;
  sub?: string;
  color: string;
  shape?: 'rect' | 'circle';
  badge?: string;
  selected?: boolean;
  [key: string]: unknown;
}

const baseStyle = (data: FlowNodeData): React.CSSProperties => ({
  borderColor: data.color,
  background: 'var(--card)',
  boxShadow: data.selected ? `0 0 0 2px ${data.color}, 0 0 12px color-mix(in oklab, ${data.color} 40%, transparent)` : '0 6px 16px rgba(35,36,31,0.08)',
});

export function RectNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div
      className="relative rounded-[10px] border-2 px-3 py-2 font-mono transition-shadow"
      style={{ ...baseStyle(d), minWidth: 92 }}
    >
      <Handle type="target" position={Position.Top} style={{ background: d.color }} />
      <div className="text-[10.5px] font-extrabold text-[var(--ink)]">{d.label}</div>
      {d.sub && <div className="text-[9px] text-[var(--dim)]">{d.sub}</div>}
      {d.badge && (
        <span className="absolute -right-2 -top-2 rounded-full px-1.5 font-mono text-[8px] font-bold text-[var(--paper)]" style={{ background: d.color }}>{d.badge}</span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: d.color }} />
    </div>
  );
}

export function CircleNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const r = d.shape === 'circle' ? 30 : 30;
  return (
    <div className="relative" style={{ width: r * 2, height: r * 2 }}>
      <Handle type="target" position={Position.Top} style={{ background: d.color, top: -2 }} />
      <div
        className="grid h-full w-full place-items-center rounded-full border-2 font-mono transition-shadow"
        style={{ ...baseStyle(d), textAlign: 'center' }}
      >
        <div>
          <div className="px-1 text-[9px] font-extrabold leading-tight text-[var(--ink)]">{d.label}</div>
          {d.badge && <div className="text-[8px] font-bold" style={{ color: d.color }}>{d.badge}</div>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: d.color, bottom: -2 }} />
    </div>
  );
}

/** Colored edge with an optional animated pulse (used by directional traffic). */
export function TokenEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps) {
  // @xyflow/react provides these via props; build a simple bezier path ourselves.
  const color = (data?.color as string) ?? 'var(--line2)';
  const w = (data?.width as number) ?? 1.6;
  const midY = (sourceY + targetY) / 2 - 18;
  const d = `M ${sourceX} ${sourceY} C ${sourceX} ${midY} ${targetX} ${midY} ${targetX} ${targetY}`;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={w} opacity={(data?.opacity as number) ?? 0.7} markerEnd={markerEnd} />
      {(data?.label as string) && (
        <text x={(sourceX + targetX) / 2} y={midY - 4} textAnchor="middle" className="font-mono" style={{ fontSize: 9, fill: color }}>{data?.label as string}</text>
      )}
    </g>
  );
}

export const nodeTypes = { rect: RectNode, circle: CircleNode };
export const edgeTypes = { token: TokenEdge };
