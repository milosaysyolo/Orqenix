// ============================================================================
// Skeleton loading variants — SkeletonCard, SkeletonTable, SkeletonGraph.
// Styled with CSS variables (--line, --card, --ink) matching the warm
// editorial design system. Imported by route-group loading.tsx files.
// ============================================================================

const SHIMMER = 'animate-pulse rounded-[7px] bg-[var(--line)]';

export function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className={`h-6 w-48 ${SHIMMER}`} />
      <div className={`mt-2 h-3 w-72 ${SHIMMER}`} />
      <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 shadow-[0_8px_22px_rgba(35,36,31,0.05)]">
        <div className={`h-4 w-32 ${SHIMMER}`} />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`mt-3 h-3 w-full ${SHIMMER}`} style={{ width: `${50 + Math.random() * 40}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className={`h-6 w-48 ${SHIMMER}`} />
      <div className={`mt-2 h-3 w-72 ${SHIMMER}`} />
      <div className="mt-6 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
        {/* header row */}
        <div className="flex gap-4 border-b border-[var(--line)] px-4 py-3">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className={`h-3 flex-1 ${SHIMMER}`} />
          ))}
        </div>
        {/* data rows */}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4 border-b border-[var(--line)] px-4 py-3">
            {Array.from({ length: cols }, (_, j) => (
              <div
                key={j}
                className={`h-3 flex-1 ${SHIMMER}`}
                style={{ width: `${60 + Math.random() * 30}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGraph() {
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <div className={`h-6 w-48 ${SHIMMER}`} />
          <div className={`mt-2 h-3 w-72 ${SHIMMER}`} />
        </div>
        <div className="flex gap-2">
          <div className={`h-7 w-16 ${SHIMMER}`} />
          <div className={`h-7 w-20 ${SHIMMER}`} />
        </div>
      </div>
      {/* filter bar skeleton */}
      <div className={`mt-3 h-10 w-full ${SHIMMER}`} />
      {/* 3-column layout */}
      <div className="mt-4 flex gap-4">
        {/* left rail */}
        <div className={`h-[400px] w-[180px] ${SHIMMER}`} />
        {/* center graph area */}
        <div className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="grid place-items-center" style={{ height: 400 }}>
            <div className="flex flex-col items-center gap-2">
              {/* graph nodes mock */}
              <div className="flex gap-8">
                <div className={`h-12 w-12 rounded-full ${SHIMMER}`} />
                <div className={`h-12 w-12 rounded-full ${SHIMMER}`} />
                <div className={`h-12 w-12 rounded-full ${SHIMMER}`} />
              </div>
              <div className="flex gap-6">
                <div className={`mt-4 h-3 w-20 ${SHIMMER}`} />
                <div className={`mt-4 h-3 w-20 ${SHIMMER}`} />
              </div>
              <div className={`mt-8 h-2 w-48 ${SHIMMER}`} />
              <div className={`mt-2 h-2 w-36 ${SHIMMER}`} />
            </div>
          </div>
        </div>
        {/* right rail */}
        <div className={`h-[400px] w-[260px] ${SHIMMER}`} />
      </div>
    </div>
  );
}
