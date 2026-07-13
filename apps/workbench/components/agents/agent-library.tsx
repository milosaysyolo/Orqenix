// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT LIBRARY — draggable palette of agent types. Drag an item onto the
// Team Canvas to add a new node. Also acts as a reference of available types.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge } from '@/components/ui';
import type { TeamNode } from '@/lib/demo-store';

const TYPES: Array<{ type: TeamNode['type']; label: string; glyph: string; color: string }> = [
  { type: 'agent', label: 'Agent', glyph: '\u25C9', color: 'var(--teal)' },
  { type: 'subagent', label: 'Subagent', glyph: '\u25C7', color: 'var(--plum)' },
  { type: 'service', label: 'Service', glyph: '\u25A3', color: 'var(--olive)' },
];

const AGENT_NAMES = ['claude-code', 'codex', 'cline', 'gpt-engineer', 'custom-agent'];
const SUBAGENT_NAMES = ['researcher', 'coder', 'tester', 'planner', 'reviewer'];
const SERVICE_NAMES = ['memory', 'search', 'embedder', 'compressor'];

function pickName(type: TeamNode['type'], used: string[]): string {
  const pool = type === 'agent' ? AGENT_NAMES : type === 'subagent' ? SUBAGENT_NAMES : SERVICE_NAMES;
  const available = pool.filter((n) => !used.includes(n));
  if (available.length === 0) return `${type}-${Math.floor(Math.random() * 999)}`;
  return available[Math.floor(Math.random() * available.length)]!;
}

export function AgentLibrary({ existingNodeIds }: { existingNodeIds: string[] }) {
  const usedNames = React.useRef<string[]>([]);

  function onDragStart(e: React.DragEvent, type: TeamNode['type']) {
    const id = `${type}_${Date.now().toString(36)}`;
    const name = pickName(type, usedNames.current);
    usedNames.current.push(name);
    e.dataTransfer.setData('application/json', JSON.stringify({ id, type, name }));
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <Panel title="Agent Library" action={<Badge tone="neutral">{TYPES.length} types</Badge>}>
      <div className="space-y-1.5">
        {TYPES.map((t) => (
          <div
            key={t.type}
            draggable
            onDragStart={(e) => onDragStart(e, t.type)}
            className="flex cursor-grab items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2 transition-colors hover:border-[var(--ink)] active:cursor-grabbing active:opacity-80"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[14px]" style={{ background: `color-mix(in oklab, ${t.color} 14%, transparent)`, color: t.color }}>{t.glyph}</span>
            <div>
              <div className="font-mono text-[11px] font-bold text-[var(--ink)]">{t.label}</div>
              <div className="font-mono text-[9px] text-[var(--faint)]">drag onto canvas</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-[var(--line)] pt-2 font-mono text-[9.5px] text-[var(--faint)]">
        {existingNodeIds.length} nodes on canvas
      </div>
    </Panel>
  );
}
