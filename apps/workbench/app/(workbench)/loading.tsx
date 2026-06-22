export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="h-8 w-56 animate-pulse rounded-[9px] bg-[var(--paper2)]" />
      <div className="mt-4 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[13px] bg-[var(--paper2)]" />
        ))}
      </div>
      <div className="mt-5 h-72 animate-pulse rounded-[13px] bg-[var(--paper2)]" />
    </div>
  );
}
