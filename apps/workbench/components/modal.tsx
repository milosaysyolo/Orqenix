// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// MODAL — shared fullscreen overlay modal with backdrop blur.
// Extracted from duplicate definitions across skills, plugins, mcp, and agents
// pages. Provides consistent modal UX across the entire workbench.
// ============================================================================

'use client';

import * as React from 'react';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** When true, modal is wider (640px vs 520px). */
  wide?: boolean;
}

export function Modal({ title, children, onClose, wide }: ModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`rounded-xl border border-[var(--line2)] bg-[var(--card)] p-5 shadow-2xl max-h-[85vh] overflow-y-auto ${
          wide ? 'w-full max-w-[640px]' : 'w-full max-w-[520px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">
            {title}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-[14px] text-[var(--faint)] hover:text-[var(--ink)]"
          >
            {'\u00D7'}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
