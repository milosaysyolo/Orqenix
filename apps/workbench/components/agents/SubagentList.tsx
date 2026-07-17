// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SUBAGENT LIST — searchable, sortable list/card view of existing subagents.
// ============================================================================

'use client';

import * as React from 'react';
import { Card, Badge } from '@/components/ui';
import type { SubagentDef, SubagentHarnessData, TeamNode } from '@/lib/demo-store';

interface SubagentListProps {
  subagents: SubagentDef[];
  saQuery: string;
  onSaQueryChange: (value: string) => void;
  saSort: 'name' | 'tasks';
  onSaSortChange: (value: 'name' | 'tasks') => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  harnesses: SubagentHarnessData[];
  teamNodes: TeamNode[];
  onEdit: (subagent: SubagentDef) => void;
  onDelete: (id: string) => void;
}

export function SubagentList({
  subagents,
  saQuery,
  onSaQueryChange,
  saSort,
  onSaSortChange,
  selectedId,
  onSelect,
  harnesses,
  teamNodes,
  onEdit,
  onDelete,
}: SubagentListProps) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--faint)]">
            {'\u2315'}
          </span>
          <input
            value={saQuery}
            onChange={(e) => onSaQueryChange(e.target.value)}
            placeholder="Search subagents\u2026"
            className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-8 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
          />
        </div>
        <select
          value={saSort}
          onChange={(e) => onSaSortChange(e.target.value as 'name' | 'tasks')}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 font-mono text-[10px] text-[var(--ink)] outline-none"
        >
          <option value="name">Name</option>
          <option value="tasks">Tasks</option>
        </select>
      </div>
      {subagents.length === 0 ? (
        <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          {saQuery
            ? 'No subagents match your search.'
            : 'No subagents defined.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {subagents.map((sa) => {
            const harness = harnesses.find(
              (h) => h.subagentKind === sa.name,
            );
            const parentName = sa.parentAgentId
              ? teamNodes.find((n) => n.id === sa.parentAgentId)?.name
              : undefined;
            return (
              <Card
                key={sa.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--rust)] ${selectedId === sa.id ? 'border-[var(--rust)]' : ''}`}
                onClick={() => onSelect(sa.id)}
              >
                <span className="font-mono text-[15px] text-[var(--plum)]">
                  {'\u25CB'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-[var(--ink)]">
                      {sa.name}
                    </span>
                    <Badge
                      tone={
                        sa.status === 'running'
                          ? 'olive'
                          : sa.status === 'error'
                            ? 'rust'
                            : 'plum'
                      }
                    >
                      {sa.status}
                    </Badge>
                    {harness && (
                      <span className="rounded-full bg-[var(--plum-light)] px-2 py-0.5 font-mono text-[9px] text-[var(--plum)]">
                        {harness.subagentKind}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 font-mono text-[9.5px] text-[var(--faint)]">
                    <span>{sa.role}</span>
                    {parentName && <span>managed by {parentName}</span>}
                    <span>{sa.tasksCompleted} tasks</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(sa);
                    }}
                    className="rounded-[6px] border border-[var(--line)] px-2 py-0.5 font-mono text-[9px] text-[var(--dim)] hover:text-[var(--ink)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(sa.id);
                    }}
                    className="rounded-[6px] border border-[var(--rust)] px-2 py-0.5 font-mono text-[9px] text-[var(--rust)]"
                  >
                    Del
                  </button>
                </div>
                <span className="font-mono text-[11px] text-[var(--faint)]">
                  {'\u203A'}
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
