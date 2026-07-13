// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SKILL RUNNER — lists registered skills that can be invoked via the runtime.
// Mirrors SkillRuntime from @orqenix/skill-runtime. Each skill shows name,
// version, category, and a Run button for demo invocation.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';

interface SkillDef {
  id: string; name: string; category: string; version: string;
  enabled: boolean; description: string;
}

export function SkillRunner({ skills }: { skills: SkillDef[] }) {
  const [running, setRunning] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ skill: string; status: string } | null>(null);

  async function handleRun(name: string) {
    setRunning(name);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    setResult({ skill: name, status: 'completed in 1.2s' });
    setRunning(null);
  }

  const enabledSkills = skills.filter((s) => s.enabled);

  return (
    <Panel
      title="Skill Runtime"
      action={<Badge tone="teal">{enabledSkills.length} ready</Badge>}
    >
      <div className="space-y-1.5">
        {enabledSkills.length === 0 && (
          <div className="py-4 text-center font-mono text-[10px] text-[var(--faint)]">no skills available</div>
        )}
        {enabledSkills.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2"
          >
            <span className="font-mono text-[14px] text-[var(--plum)]">{'\u2726'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px] font-bold text-[var(--ink)]">{s.name}</div>
              <div className="font-mono text-[9px] text-[var(--faint)]">
                {s.category} · v{s.version}
              </div>
            </div>
            <Button
              size="sm"
              variant={running === s.name ? 'ghost' : 'primary'}
              onClick={() => handleRun(s.name)}
              disabled={running === s.name}
            >
              {running === s.name ? 'running…' : 'run'}
            </Button>
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-3 rounded-[7px] border border-[var(--olive)] bg-[color-mix(in_oklab,var(--olive)_6%,transparent)] px-3 py-2 font-mono text-[10px] text-[var(--olive)]">
          {'\u2713'} {result.skill}: {result.status}
        </div>
      )}
    </Panel>
  );
}
