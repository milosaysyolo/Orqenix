// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { api } from '@/lib/api';

export function SeedButton() {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function seed(force = false) {
    setBusy(true);
    const res = await api.post('/api/dev/seed' + (force ? '?force=1' : ''));
    setBusy(false);
    if (res.ok) location.reload();
    else alert('Seed failed: ' + (res.error ?? 'unknown'));
  }
  async function reset() {
    if (!confirm('Clear all sample data for this project?')) return;
    setBusy(true);
    const res = await api.post('/api/dev/reset');
    setBusy(false);
    if (res.ok) location.reload();
    else alert('Reset failed: ' + (res.error ?? 'unknown'));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="rounded-[7px] border border-[var(--line2)] bg-[var(--card)] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[var(--rust)] transition-colors hover:border-[var(--rust)] disabled:opacity-50"
        title="Dev: seed or reset sample data"
      >
        {busy ? '\u2026' : '\u2726 data'}
      </button>
      {open && !busy && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-[9px] border border-[var(--line2)] bg-[var(--card)] p-1 shadow">
          <button onClick={() => seed(false)} className="block w-full rounded px-2 py-1.5 text-left font-mono text-[11px] text-[var(--ink)] hover:bg-[var(--paper2)]">{'\u2726'} Seed demo data</button>
          <button onClick={() => seed(true)} className="block w-full rounded px-2 py-1.5 text-left font-mono text-[10.5px] text-[var(--dim)] hover:bg-[var(--paper2)]">{'\u21BB'} Re-seed (force)</button>
          <button onClick={reset} className="block w-full rounded px-2 py-1.5 text-left font-mono text-[10.5px] text-[var(--dim)] hover:bg-[var(--paper2)]">Reset (clear)</button>
        </div>
      )}
    </div>
  );
}
