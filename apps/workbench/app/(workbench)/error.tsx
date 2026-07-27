'use client';

import * as React from 'react';
import { SectionTitle } from '@/components/ui';

export default function WorkbenchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[600px] px-6 py-16 text-center">
      <div className="text-[48px] text-[var(--rust)] opacity-40">{'\u26A0'}</div>
      <SectionTitle sub="Something went wrong">Error</SectionTitle>
      <p className="mt-4 font-mono text-[12px] text-[var(--dim)]">{error.message}</p>
      {error.digest && <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">digest: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-6 rounded-[9px] border border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] px-4 py-2 font-mono text-[12px] font-bold text-[var(--rust)] hover:bg-[color-mix(in_oklab,var(--rust)_14%,transparent)]"
      >try again</button>
    </div>
  );
}
