// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// KEYBOARD SHORTCUTS OVERLAY — native editorial (Interaction pillar). Opened
// via `?`. Lists every binding grouped by category.
// ============================================================================

"use client";

import { Card, Kbd } from './ui';

interface Binding { keys: string[]; desc: string; }
interface Group { category: string; bindings: Binding[]; }

const GROUPS: Group[] = [
  {
    category: "Navigation",
    bindings: [
      { keys: ['\u2318', 'K'], desc: 'Open command palette' },
      { keys: ['G', 'D'], desc: 'Go to Dashboard' },
      { keys: ['G', 'M'], desc: 'Go to Memory' },
      { keys: ['G', 'O'], desc: 'Go to Orchestrator' },
      { keys: ['G', 'R'], desc: 'Go to Runner' },
      { keys: ['G', 'S'], desc: 'Go to Sessions' },
      { keys: ['G', 'N'], desc: 'Go to Network' },
      { keys: ['G', 'P'], desc: 'Go to Marketplace' },
      { keys: ['G', 'X'], desc: 'Go to Mesh' },
      { keys: ['G', 'A'], desc: 'Go to Audit' },
      { keys: ['G', 'L'], desc: 'Go to Learning' },
      { keys: ['G', 'B'], desc: 'Go to Branches' },
      { keys: ['G', ','], desc: 'Go to Settings' },
    ],
  },
  {
    category: 'Canvas',
    bindings: [
      { keys: ['Del'], desc: 'Remove selected node / edge' },
      { keys: ['\u2318', 'Z'], desc: 'Undo' },
      { keys: ['\u2318', '\u21E7', 'Z'], desc: 'Redo' },
      { keys: ['\u2318', 'A'], desc: 'Select all' },
      { keys: ['Esc'], desc: 'Deselect / cancel connect mode' },
    ],
  },
  {
    category: "General",
    bindings: [
      { keys: ['?'], desc: 'Show this overlay' },
      { keys: ['\u2318', '\\'], desc: 'Toggle theme' },
      { keys: ['Space'], desc: 'Pause / resume live timeline' },
    ],
  },
];

export function KeyboardShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button className="fixed inset-0 bg-[rgba(35,36,31,0.32)] backdrop-blur-[2px]" onClick={onClose} aria-label="Close shortcuts" />
      <Card className="relative max-h-[82vh] w-full max-w-[640px] animate-scale-in overflow-y-auto scroll-thin p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-[20px] font-semibold text-[var(--ink)]">Keyboard Shortcuts</h2>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--dim)]">Press <Kbd>?</Kbd> any time to toggle.</p>
          </div>
          <button onClick={onClose} className="font-mono text-[16px] text-[var(--faint)] hover:text-[var(--ink)]" aria-label="Close">{'\u00D7'}</button>
        </div>
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g.category}>
              <div className="mb-2 font-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--rust)]">{g.category}</div>
              <div className="space-y-1.5">
                {g.bindings.map((b) => (
                  <div key={b.desc} className="flex items-center justify-between py-1">
                    <span className="font-mono text-[12px] text-[var(--dim)]">{b.desc}</span>
                    <span className="flex items-center gap-1">
                      {b.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {i < b.keys.length - 1 && <span className="font-mono text-[10px] text-[var(--faint)]">+</span>}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
