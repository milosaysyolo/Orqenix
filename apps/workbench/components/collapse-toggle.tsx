// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// COLLAPSE TOGGLE — unified pill button for panel collapse/expand.
//
// Two visual modes (same design, different positioning):
//   floating   — absolutely positioned at the edge of an EXPANDED panel,
//                overhanging by -12 px so it sits on the border seam.
//   standalone — a self-contained pill whose wrapper is always visible,
//                used for the collapsed-state expand trigger.
//
// On state change the button cross-fades: both the old and new button are
// always in the DOM, toggled via opacity + scale transitions.
// ============================================================================

'use client';

import * as React from 'react';

function ToggleButton({
  collapsed,
  onToggle,
  side,
  label,
}: {
  collapsed: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
  label?: string;
}) {
  const dir = collapsed
    ? side === 'left' ? '\u2192' : '\u2190'
    : side === 'left' ? '\u2190' : '\u2192';

  return (
    <button
      onClick={onToggle}
      title={label ?? (collapsed ? 'Expand' : 'Collapse')}
      className={
        'inline-flex items-center justify-center gap-1 rounded-full border border-[var(--line)] ' +
        'bg-[var(--card)] px-2 py-1 font-mono text-[11px] shadow-sm transition-all ' +
        'hover:border-[var(--rust)] hover:text-[var(--rust)] ' +
        (collapsed
          ? 'text-[var(--rust)]'
          : 'text-[var(--faint)]')
      }
    >
      <span className={collapsed ? '' : 'opacity-60'}>{dir}</span>
      <span className="hidden sm:inline">{label ?? (collapsed ? 'Show' : 'Collapse')}</span>
    </button>
  );
}

export function CollapseToggle({
  collapsed,
  onToggle,
  side = 'left',
  label,
  variant = 'inline',
}: {
  collapsed: boolean;
  onToggle: () => void;
  side?: 'left' | 'right';
  label?: string;
  variant?: 'inline' | 'floating' | 'standalone';
}) {
  // floating — absolute overhang on the expanded panel
  if (variant === 'floating') {
    return (
      <div
        className="absolute top-3 z-10 transition-all duration-200"
        style={{
          [side === 'left' ? 'right' : 'left']: '-12px',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? ('none' as const) : ('auto' as const),
          transform: collapsed ? 'scale(0.85)' : 'scale(1)',
        }}
      >
        <ToggleButton collapsed={false} onToggle={onToggle} side={side} label={label} />
      </div>
    );
  }

  // standalone — centred pill when panel is collapsed
  if (variant === 'standalone') {
    return (
      <div
        className="flex items-center justify-center transition-all duration-200"
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? ('auto' as const) : ('none' as const),
          transform: collapsed ? 'scale(1)' : 'scale(0.85)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="h-px w-3 bg-[var(--line)]" />
          <ToggleButton collapsed={true} onToggle={onToggle} side={side} label={label} />
          <span className="h-px w-3 bg-[var(--line)]" />
        </div>
      </div>
    );
  }

  // inline — default, flush with text
  const dir = collapsed
    ? side === 'left' ? '\u2192' : '\u2190'
    : side === 'left' ? '\u2190' : '\u2192';

  return (
    <button
      onClick={onToggle}
      title={label ?? (collapsed ? 'Expand' : 'Collapse')}
      className="inline-flex items-center justify-center rounded-[5px] border border-transparent px-1 font-mono text-[11px] text-[var(--faint)] transition-colors hover:border-[var(--line)] hover:text-[var(--ink)]"
    >
      {dir}
    </button>
  );
}
