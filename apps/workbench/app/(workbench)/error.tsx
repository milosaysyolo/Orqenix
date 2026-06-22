'use client';

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[600px] px-6 py-20 text-center">
      <div className="font-serif text-[22px] font-semibold text-[var(--ink)]">Something went wrong</div>
      <p className="mt-2 font-mono text-[11px] text-[var(--dim)]">{error.message}</p>
      <button onClick={reset}
        className="mt-4 rounded-[9px] border border-[var(--line2)] bg-[var(--card)] px-4 py-2 font-mono text-[12px] font-semibold text-[var(--ink)] hover:border-[var(--rust)]">
        ↻ Retry
      </button>
    </div>
  );
}
