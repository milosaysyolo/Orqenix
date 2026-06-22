// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/run-query-button.tsx
// Purpose: A small "Run a query" control on the Dashboard that POSTs to
//   /api/query/demo, which runs a real engine query and emits live stage events
//   the ContextPipeline animates. Demonstrates the full live loop with real data.
// Rules: 'use client'. Use lib/api. Disable while running. Show inline result.
// ============================================================================

'use client';

import * as React from 'react';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';

export function RunQueryButton() {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    const res = await api.post<{ ok: boolean; hits: number; levelsQueried: string[] }>('/api/query/demo', {
      prompt: 'how does our JWT refresh flow handle rotation?',
    });
    setBusy(false);
    setNote(res.ok ? `recalled ${res.data?.hits ?? 0} · levels ${res.data?.levelsQueried?.join('/')}` : (res.error ?? 'failed'));
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="primary" size="sm" onClick={run} disabled={busy}>
        {busy ? 'running…' : '▶ run query'}
      </Button>
      {note && <span className="font-mono text-[10.5px] text-[var(--dim)]">{note}</span>}
    </div>
  );
}
