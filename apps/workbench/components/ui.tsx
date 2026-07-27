// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// Shared presentational primitives every screen reuses, styled with the
// warm editorial tokens. Card, Panel, SectionTitle, Badge, Button, Kbd, Stat,
// LiveDot. Keeps all screens visually consistent with the landing aesthetic.
// Rules: 'use client'. Tokens only (var(--rust) etc). No external UI lib.
//   Buttons support variant: primary(rust)/outline/ghost/danger and size sm/md.
// ============================================================================

'use client';

import * as React from 'react';

export function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-[var(--line)] bg-[var(--card)] shadow-[0_8px_22px_rgba(35,36,31,0.05)]', className)} {...props}>
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          {title && <div className="font-mono text-data-sm font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">{title}</div>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-serif text-[26px] font-semibold tracking-tight text-[var(--ink)]">{children}</h1>
      {sub && <p className="mt-0.5 text-data-lg text-[var(--dim)]">{sub}</p>}
    </div>
  );
}

export type BadgeTone = 'rust' | 'amber' | 'teal' | 'plum' | 'olive' | 'slate' | 'neutral';
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
      className={cn('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-data-xs font-bold uppercase tracking-wide', className)}
      style={{ color: c, background: `color-mix(in oklab, ${c} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function Button({ variant = 'outline', size = 'md', className, ...props }: {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-mono font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50';
  const sizes = size === 'sm' ? 'text-data-sm px-2.5 py-1 rounded-sm' : 'text-data-base px-3.5 py-1.5 rounded-md';
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
      <div className="font-mono text-data-xs uppercase tracking-[0.1em] text-[var(--faint)]">{label}</div>
      <div className="mt-0.5 font-mono text-[22px] font-extrabold" style={{ color }}>{value}</div>
      {delta && <div className="mt-0.5 font-mono text-data-sm text-[var(--olive)]">{delta}</div>}
    </Card>
  );
}

export function LiveDot({ on }: { on: boolean }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', on ? 'animate-pulse bg-[var(--olive)]' : 'bg-[var(--faint)]')} />;
}

/** Keyboard-key hint chip, used by shortcuts overlay and palette. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--line2)] bg-[var(--paper2)] px-1.5 font-mono text-[10px] font-bold text-[var(--ink)]">
      {children}
    </kbd>
  );
}
