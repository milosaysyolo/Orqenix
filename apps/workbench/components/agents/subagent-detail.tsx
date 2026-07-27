// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SUBAGENT DETAIL — expanded view of a subagent aligned with Orqenix
// memory-engine. Shows harness configuration (systemPrompt, goal, constraints,
// scopedContext, returnSchema), harness lifecycle pipeline (validate → run →
// absorb), invocation history with expandable details, and spawn/absorb actions.
//
// Based on SubagentHarnessManager + ReturnAbsorber from @orqenix/memory-engine.
// ============================================================================

'use client';

import * as React from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import type { SubagentDef, SubagentHarnessData, SubagentInvocationRecord } from '@/lib/demo-store';

const STATUS_TONE: Record<string, 'olive' | 'amber' | 'rust'> = {
  success: 'olive', timeout: 'amber', error: 'rust',
};

const STATUS_TONE_AGENT: Record<string, 'olive' | 'plum' | 'rust'> = {
  running: 'olive', idle: 'plum', error: 'rust',
};

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Harness Lifecycle Pipeline ──────────────────────────────────────────────
// Visualizes the 3-phase flow from SubagentHarnessManager:
//   Phase A: Validate → Phase B: Run → Phase C: Absorb

function HarnessLifecycle({ harness, lastInv }: {
  harness: SubagentHarnessData | null;
  lastInv: SubagentInvocationRecord | null;
}) {
  if (!harness) return null;

  const c = harness.constraints;

  // Phase A validation checks
  const checks = [
    { label: 'systemPrompt', ok: harness.systemPrompt.length > 0 },
    { label: 'goal', ok: harness.goal.length > 0 },
    { label: 'returnSchema', ok: Object.keys(harness.returnSchema).length > 0 },
    { label: 'no sub-subagent', ok: !c.allowedTools.some((t) => t.includes('spawn_subagent') || t.includes('invoke_subagent')) },
  ];
  const allValid = checks.every((ch) => ch.ok);

  return (
    <div className="mt-3">
      <div className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">
        Harness Lifecycle
      </div>
      <div className="mt-1.5 flex items-stretch gap-1">
        {/* Phase A: Validate */}
        <div className={`flex-1 rounded-[6px] border px-2 py-1.5 font-mono text-[9px] ${
          allValid
            ? 'border-[var(--olive)] bg-[color-mix(in_oklab,var(--olive)_6%,transparent)]'
            : 'border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_6%,transparent)]'
        }`}>
          <div className="font-bold text-[10px]">A. Validate</div>
          <div className="mt-1 space-y-0.5">
            {checks.map((ch) => (
              <div key={ch.label} className={ch.ok ? 'text-[var(--olive)]' : 'text-[var(--rust)]'}>
                {ch.ok ? '\u2713' : '\u2717'} {ch.label}
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center font-mono text-[11px] text-[var(--faint)]">{'\u2192'}</div>

        {/* Phase B: Run */}
        <div className={`flex-1 rounded-[6px] border px-2 py-1.5 font-mono text-[9px] ${
          lastInv
            ? lastInv.status === 'success'
              ? 'border-[var(--olive)] bg-[color-mix(in_oklab,var(--olive)_6%,transparent)]'
              : 'border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_6%,transparent)]'
            : 'border-[var(--line)] bg-[var(--paper)]'
        }`}>
          <div className="font-bold text-[10px]">B. Run</div>
          <div className="mt-1 space-y-0.5">
            <div>maxSteps: <span className="font-bold text-[var(--ink)]">{c.maxSteps}</span></div>
            <div>maxWall: <span className="font-bold text-[var(--ink)]">{c.maxWallTimeSec}s</span></div>
            {lastInv && (
              <>
                <div>steps: <span className="font-bold text-[var(--ink)]">{lastInv.stepsTaken}</span></div>
                <div>time: <span className="font-bold text-[var(--ink)]">{(lastInv.wallTimeMs / 1000).toFixed(1)}s</span></div>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center font-mono text-[11px] text-[var(--faint)]">{'\u2192'}</div>

        {/* Phase C: Absorb */}
        <div className={`flex-1 rounded-[6px] border px-2 py-1.5 font-mono text-[9px] ${
          lastInv?.absorbResult
            ? 'border-[var(--teal)] bg-[color-mix(in_oklab,var(--teal)_6%,transparent)]'
            : 'border-[var(--line)] bg-[var(--paper)]'
        }`}>
          <div className="font-bold text-[10px]">C. Absorb</div>
          <div className="mt-1 space-y-0.5">
            {lastInv?.absorbResult ? (
              <>
                <div className="text-[var(--teal)]">T1: {lastInv.absorbResult.t1EntryId}</div>
                <div className="text-[var(--olive)]">T2: {lastInv.absorbResult.t2EntryId}</div>
                <div className="text-[var(--dim)]">never_compress</div>
              </>
            ) : (
              <div className="text-[var(--faint)]">pending</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expandable Invocation Row ───────────────────────────────────────────────

function InvocationRow({ inv }: { inv: SubagentInvocationRecord }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-[6px] border border-[var(--line)] bg-[var(--paper)] overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-2 py-1.5 font-mono text-[9.5px] text-left hover:bg-[color-mix(in_oklab,var(--paper2)_60%,transparent)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Badge tone={STATUS_TONE[inv.status] ?? 'neutral'}>{inv.status}</Badge>
        <span className="text-[var(--faint)]">{daysAgo(inv.invokedAt)}</span>
        <span className="text-[var(--dim)]">{(inv.wallTimeMs / 1000).toFixed(1)}s</span>
        <span className="text-[var(--dim)]">{inv.stepsTaken} steps</span>
        <span className="ml-auto font-mono text-[9px] text-[var(--faint)]">{expanded ? '\u25B4' : '\u25BE'}</span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--line)] px-2 py-1.5 space-y-1 font-mono text-[9px]">
          <div className="flex gap-2">
            {inv.t1EntryId && <span className="text-[var(--teal)]">T1: {inv.t1EntryId}</span>}
            {inv.t2EntryId && <span className="text-[var(--olive)]">T2: {inv.t2EntryId}</span>}
          </div>
          {inv.returnData && (
            <div>
              <span className="text-[var(--faint)]">return: </span>
              <span className={inv.returnData.outputMatchesSchema ? 'text-[var(--olive)]' : 'text-[var(--rust)]'}>
                {inv.returnData.outputMatchesSchema ? 'schema match' : 'schema mismatch'}
              </span>
            </div>
          )}
          {inv.absorbResult && (
            <div className="rounded-[4px] bg-[color-mix(in_oklab,var(--teal)_6%,transparent)] px-2 py-1 text-[var(--teal)]">
              Absorbed into parent memory (T1+T2, never_compress, x10 boost)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SubagentDetail({
  subagent,
  harness,
  invocations,
  onClose,
  onStatusChange,
}: {
  subagent: SubagentDef;
  harness: SubagentHarnessData | null;
  invocations: SubagentInvocationRecord[];
  onClose: () => void;
  onStatusChange?: (id: string, status: SubagentDef['status']) => void;
}) {
  const { toast } = useToast();
  const [spawning, setSpawning] = React.useState(false);
  const [showAbsorb, setShowAbsorb] = React.useState(false);

  const myInvocations = invocations.filter((i) => i.subagentId === subagent.id).slice(-8).reverse();
  const lastInvocation = myInvocations[0] ?? null;

  async function handleSpawn() {
    setSpawning(true);
    const res = await api.post<{ ok: boolean; invocation: SubagentInvocationRecord }>('/api/agents/subagents/invocations', { subagentId: subagent.id });
    setSpawning(false);
    if (res.ok && res.data) {
      toast({ tone: 'success', title: subagent.name, message: `Spawned \u00B7 ${res.data.invocation.stepsTaken} steps \u00B7 ${(res.data.invocation.wallTimeMs / 1000).toFixed(0)}s` });
      onStatusChange?.(subagent.id, 'running');
    } else {
      toast({ tone: 'error', title: 'Spawn failed', message: res.error ?? 'unknown error' });
    }
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={STATUS_TONE_AGENT[subagent.status] ?? 'neutral'}>{subagent.status}</Badge>
          <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{subagent.name}</span>
          {harness && (
            <span className="rounded-full bg-[var(--plum-light)] px-2 py-0.5 font-mono text-[9px] text-[var(--plum)]">{harness.subagentKind}</span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>{'\u00D7'}</Button>
      </div>

      <div className="mt-1 font-mono text-[10px] text-[var(--dim)]">{subagent.role}</div>

      <div className="mt-2 text-[10px] font-mono text-[var(--dim)]">
        tasks: <span className="font-bold text-[var(--ink)]">{subagent.tasksCompleted}</span>
        &nbsp;\u00B7 uptime: <span className="font-bold text-[var(--ink)]">{subagent.uptime}</span>
      </div>

      {/* Harness Configuration */}
      {harness && (
        <div className="mt-3 space-y-2">
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Harness</div>
          <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <div className="font-mono text-[10px]">
              <span className="text-[var(--faint)]">kind: </span>
              <span className="font-bold text-[var(--plum)]">{harness.subagentKind}</span>
            </div>
            <div className="mt-1 font-mono text-[10px]">
              <span className="text-[var(--faint)]">goal: </span>
              <span className="text-[var(--ink)]">{harness.goal}</span>
            </div>
            <details className="mt-1.5">
              <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">system prompt</summary>
              <p className="mt-1 font-mono text-[9.5px] text-[var(--dim)] leading-relaxed">{harness.systemPrompt}</p>
            </details>
            <details className="mt-1">
              <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">constraints</summary>
              <div className="mt-1 space-y-0.5 font-mono text-[9.5px] text-[var(--dim)]">
                <div>max steps: <span className="font-bold text-[var(--ink)]">{harness.constraints.maxSteps}</span></div>
                <div>max wall: <span className="font-bold text-[var(--ink)]">{harness.constraints.maxWallTimeSec}s</span></div>
                <div>allowed: <span className="text-[var(--teal)]">{harness.constraints.allowedTools.join(', ')}</span></div>
                <div>forbidden: <span className="text-[var(--rust)]">{harness.constraints.forbiddenTools.join(', ')}</span></div>
              </div>
            </details>
            <details className="mt-1">
              <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">scoped context</summary>
              <div className="mt-1 space-y-0.5 font-mono text-[9.5px] text-[var(--dim)]">
                <div>entryIds: <span className="text-[var(--teal)]">{harness.scopedContext.entryIds.join(', ')}</span></div>
                <div>rationale: <span className="text-[var(--ink)]">{harness.scopedContext.rationale}</span></div>
              </div>
            </details>
            <details className="mt-1">
              <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">return schema</summary>
              <div className="mt-1 font-mono text-[9.5px] text-[var(--dim)]">
                {Object.entries(harness.returnSchema).map(([k, v]) => (
                  <div key={k}>{k}: <span className="text-[var(--ink)]">{String(v)}</span></div>
                ))}
              </div>
            </details>
          </div>

          {/* Anti-pattern 36 badge */}
          <div className="rounded-[5px] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] px-2 py-1 font-mono text-[9px] text-[var(--amber)]">
            Anti-pattern 36: single-level depth enforced \u2014 subagent cannot spawn sub-subagents
          </div>

          {/* Harness Lifecycle Pipeline */}
          <HarnessLifecycle harness={harness} lastInv={lastInvocation} />
        </div>
      )}

      {/* Invocation History */}
      <div className="mt-3">
        <div className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">
          Invocations ({myInvocations.length})
        </div>
        {myInvocations.length === 0 ? (
          <div className="mt-1 text-center font-mono text-[9.5px] text-[var(--faint)] py-2">no invocations yet</div>
        ) : (
          <div className="mt-1 space-y-1">
            {myInvocations.map((inv) => (
              <InvocationRow key={inv.id} inv={inv} />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={subagent.status === 'running' || spawning}
          onClick={() => void handleSpawn()}
        >
          {spawning ? '\u2026' : subagent.status === 'running' ? 'already running' : 'Spawn Subagent'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!lastInvocation}
          onClick={() => setShowAbsorb(true)}
        >
          View Absorb Result
        </Button>
      </div>

      {/* View Absorb Result Modal */}
      {showAbsorb && lastInvocation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAbsorb(false)}>
          <div
            className="w-full max-w-[500px] rounded-xl border border-[var(--line2)] bg-[var(--card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
                Absorb Result \u00B7 {subagent.name}
              </span>
              <button onClick={() => setShowAbsorb(false)} className="font-mono text-[14px] text-[var(--faint)] hover:text-[var(--ink)]">{'\u00D7'}</button>
            </div>
            <div className="space-y-3 font-mono text-[10.5px]">
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[lastInvocation.status] ?? 'neutral'}>{lastInvocation.status}</Badge>
                <span className="text-[var(--dim)]">{daysAgo(lastInvocation.invokedAt)}</span>
                <span className="text-[var(--dim)]">{(lastInvocation.wallTimeMs / 1000).toFixed(0)}s</span>
                <span className="text-[var(--dim)]">{lastInvocation.stepsTaken} steps</span>
              </div>

              {harness && (
                <>
                  <div>
                    <div className="text-[var(--faint)] mb-1">Return Schema</div>
                    <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] p-2 space-y-0.5">
                      {Object.entries(harness.returnSchema).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-[var(--teal)]">{k}</span>
                          <span className="text-[var(--faint)]">: {String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[var(--faint)] mb-1">Absorbed Memory Entries</div>
                    <div className="flex flex-wrap gap-1">
                      {lastInvocation.absorbResult && (
                        <>
                          <Badge tone="teal">T1: {lastInvocation.absorbResult.t1EntryId}</Badge>
                          <Badge tone="olive">T2: {lastInvocation.absorbResult.t2EntryId}</Badge>
                        </>
                      )}
                      {!lastInvocation.absorbResult && (
                        <span className="text-[var(--faint)]">no entries absorbed</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-[7px] bg-[color-mix(in_oklab,var(--teal)_8%,transparent)] px-3 py-2 text-[9.5px] text-[var(--teal)]">
                This result has been absorbed into the knowledge base. Memory entries have never_compress + never_move_tier protection and surface with x10 boost.
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
