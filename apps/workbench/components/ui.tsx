// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/ui.tsx
// Purpose: Shared presentational primitives every screen reuses, styled with the
//   warm editorial tokens. Card, Panel, SectionTitle, Badge, Button, Kbd, Stat.
//   Keeps all screens visually consistent with the landing page aesthetic.
// Rules: 'use client'. Tokens only (var(--rust) etc). No external UI lib. Buttons
//   support variant: primary(rust)/outline/ghost/danger and size sm/md.
// ============================================================================

'use client';

import * as React from 'react';

export function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-[13px] border border-[var(--line)] bg-[var(--card)] shadow-[0_8px_22px_rgba(35,36,31,0.05)]', className)}>
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
      <Card {...(className ? { className } : {})}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          {title && <div className="font-mono text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">{title}</div>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-1">
      <h1 className="font-serif text-[28px] font-semibold tracking-tight text-[var(--ink)]">{children}</h1>
      {sub && <p className="mt-1 text-[13px] text-[var(--dim)]">{sub}</p>}
    </div>
  );
}

type BadgeTone = 'rust' | 'amber' | 'teal' | 'plum' | 'olive' | 'slate' | 'neutral';
const toneColor: Record<BadgeTone, string> = {
  rust: 'var(--rust)', amber: 'var(--amber)', teal: 'var(--teal)',
  plum: 'var(--plum)', olive: 'var(--olive)', slate: 'var(--slate)', neutral: 'var(--dim)',
};

export function Badge({ tone = 'neutral', children, className }: {
  tone?: BadgeTone; children: React.ReactNode; className?: string;
}) {
  const c = toneColor[tone];
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide', className)}
      style={{ color: c, background: `color-mix(in oklab, ${c} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function Button({ variant = 'outline', size = 'md', className, ...props }: {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-mono font-semibold transition-colors disabled:opacity-50';
  const sizes = size === 'sm' ? 'text-[11px] px-2.5 py-1 rounded-[6px]' : 'text-[12px] px-3.5 py-1.5 rounded-[9px]';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--rust)] text-[var(--paper)] border border-[var(--rust)] hover:opacity-90',
    outline: 'bg-[var(--card)] text-[var(--ink)] border border-[var(--line2)] hover:border-[var(--ink)]',
    ghost: 'bg-transparent text-[var(--dim)] hover:text-[var(--ink)] border border-transparent',
    danger: 'bg-transparent text-[var(--rust)] border border-[var(--line2)] hover:border-[var(--rust)]',
  };
  return <button className={cn(base, sizes, variants[variant], className)} {...props} />;
}

export function Stat({ label, value, delta, accent = 'ink' }: {
  label: string; value: React.ReactNode; delta?: string; accent?: 'ink' | BadgeTone;
}) {
  const color = accent === 'ink' ? 'var(--ink)' : toneColor[accent];
  return (
    <Card className="px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">{label}</div>
      <div className="mt-1 font-mono text-[22px] font-extrabold" style={{ color }}>{value}</div>
      {delta && <div className="mt-0.5 font-mono text-[10.5px] text-[var(--olive)]">{delta}</div>}
    </Card>
  );
}

export function LiveDot({ on }: { on: boolean }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', on ? 'animate-pulse bg-[var(--olive)]' : 'bg-[var(--faint)]')} />;
}
