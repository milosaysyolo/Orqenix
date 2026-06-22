'use client';

import * as React from 'react';

interface GNode { id: string; label: string; type: string; kb?: string; tier?: string; count?: number; }
interface GEdge { from: string; to: string; type: string; label?: string; }

const KB_COLOR: Record<string, string> = {
  chat: 'var(--amber)', code: 'var(--teal)', decision: 'var(--plum)', lesson: 'var(--slate)',
};
const TYPE_COLOR: Record<string, string> = {
  project: 'var(--teal)', branch: 'var(--plum)', kb: 'var(--rust)', entry: 'var(--slate)',
};

export function GraphView({
  nodes, edges, selectedId, onSelect, onPin,
}: {
  nodes: GNode[]; edges: GEdge[]; selectedId: string | null;
  onSelect: (id: string) => void; onPin?: (n: GNode) => void;
}) {
  const W = 900, H = 560, cx = W / 2, cy = H / 2;
  const pos = React.useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    map.set('project', { x: cx, y: cy });
    const ring1 = nodes.filter((n) => n.type === 'kb' || n.type === 'branch');
    ring1.forEach((n, i) => {
      const a = (i / Math.max(1, ring1.length)) * Math.PI * 2;
      map.set(n.id, { x: cx + Math.cos(a) * 180, y: cy + Math.sin(a) * 150 });
    });
    const entries = nodes.filter((n) => n.type === 'entry');
    entries.forEach((n, i) => {
      const a = (i / Math.max(1, entries.length)) * Math.PI * 2 + 0.4;
      map.set(n.id, { x: cx + Math.cos(a) * 300, y: cy + Math.sin(a) * 240 });
    });
    return map;
  }, [nodes]);

  const colorOf = (n: GNode) => (n.type === 'entry' && n.kb ? KB_COLOR[n.kb] : TYPE_COLOR[n.type]) ?? 'var(--dim)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {edges.map((e, i) => {
        const a = pos.get(e.from), b = pos.get(e.to);
        if (!a || !b) return null;
        const linked = e.type === 'linked';
        return (
          <g key={i}>
            <path
              d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 24} ${b.x} ${b.y}`}
              fill="none"
              stroke={linked ? 'var(--rust)' : e.type === 'promoted' ? 'var(--olive)' : 'var(--line2)'}
              strokeWidth={linked ? 2.4 : 1.2}
              strokeDasharray={e.type === 'cloned' || linked ? '6 5' : undefined}
              opacity={linked ? 0.9 : 0.45}
              style={linked ? { filter: 'drop-shadow(0 0 4px var(--rust))' } : undefined}
            />
            {e.label && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 26} textAnchor="middle"
                className="font-mono" style={{ fontSize: 9, fill: linked ? 'var(--rust)' : 'var(--faint)' }}>
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const sel = n.id === selectedId;
        const r = n.type === 'project' ? 30 : n.type === 'kb' || n.type === 'branch' ? 22 : 16;
        return (
          <g
            key={n.id}
            transform={`translate(${p.x},${p.y})`}
            className="cursor-pointer"
            onClick={() => onSelect(n.id)}
            onDoubleClick={() => n.type === 'entry' && onPin?.(n)}
            opacity={selectedId && !sel ? 0.4 : 1}
          >
            <circle r={r} fill="var(--card)" stroke={colorOf(n)} strokeWidth={sel ? 3.5 : 2.2}
              style={sel ? { filter: `drop-shadow(0 0 10px ${colorOf(n)})` } : undefined} />
            <text textAnchor="middle" dy={r + 12} className="font-mono" style={{ fontSize: 9.5, fill: 'var(--ink)' }}>
              {n.label}
            </text>
            {n.count != null && (
              <text textAnchor="middle" dy={3} className="font-mono font-bold" style={{ fontSize: 9, fill: colorOf(n) }}>
                {n.count}
              </text>
            )}
            {n.tier && (
              <text textAnchor="middle" dy={3} className="font-mono font-bold" style={{ fontSize: 8, fill: 'var(--dim)' }}>
                {n.tier}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
