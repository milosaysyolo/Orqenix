// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SANDBOX STATUS — shows the list of sandboxed plugins with their lifecycle
// state (active / inactive / crashed) and invoke actions. Mirrors the
// SandboxManager reference from @orqenix/plugin-core.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';

interface SandboxPlugin {
  name: string; kind: string; state: 'active' | 'inactive' | 'crashed';
  entryPoint: string; crashCount: number;
}

const STATE_TONE: Record<string, 'olive' | 'neutral' | 'rust'> = {
  active: 'olive', inactive: 'neutral', crashed: 'rust',
};

export function SandboxStatus({ plugins }: { plugins: SandboxPlugin[] }) {
  const [busy, setBusy] = React.useState<string | null>(null);

  async function handleToggle(p: SandboxPlugin) {
    setBusy(p.name);
    // Simulate lifecycle action
    await new Promise((r) => setTimeout(r, 600));
    setBusy(null);
  }

  const activeCount = plugins.filter((p) => p.state === 'active').length;
  const crashedCount = plugins.filter((p) => p.state === 'crashed').length;

  return (
    <Panel
      title="Sandbox"
      action={
        <span className="flex items-center gap-2 font-mono text-[9.5px]">
          <Badge tone="olive">{activeCount} active</Badge>
          {crashedCount > 0 && <Badge tone="rust">{crashedCount} crashed</Badge>}
        </span>
      }
    >
      <div className="space-y-1.5">
        {plugins.length === 0 && (
          <div className="py-4 text-center font-mono text-[10px] text-[var(--faint)]">no plugins loaded</div>
        )}
        {plugins.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: p.state === 'active' ? 'var(--olive)' : p.state === 'crashed' ? 'var(--rust)' : 'var(--faint)' }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px] font-bold text-[var(--ink)]">{p.name}</div>
              <div className="font-mono text-[9px] text-[var(--faint)]">{p.kind} · {p.entryPoint}</div>
            </div>
            <Badge tone={STATE_TONE[p.state] ?? 'neutral'}>{p.state}</Badge>
            {p.state === 'active' ? (
              <Button size="sm" variant="ghost" onClick={() => handleToggle(p)} disabled={busy === p.name}>
                {busy === p.name ? '…' : 'deactivate'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleToggle(p)} disabled={busy === p.name}>
                {busy === p.name ? '…' : 'activate'}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
