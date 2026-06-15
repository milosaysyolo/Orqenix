// SPDX-License-Identifier: Apache-2.0
// Keyboard shortcuts overlay , triggered by ? key per CR v8.0 G61-15

'use client';

import { useEffect } from 'react';
import { Card, CardContent, Badge } from '@orqenix/ui-primitives';
import { X } from 'lucide-react';

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    category: 'Navigation',
    bindings: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['G', 'M'], description: 'Go to Memory' },
      { keys: ['G', 'X'], description: 'Go to Mesh' },
      { keys: ['G', 'A'], description: 'Go to Audit' },
      { keys: ['G', 'P'], description: 'Go to Marketplace' },
      { keys: ['G', 'L'], description: 'Go to Self-Learning' },
      { keys: ['G', 'S'], description: 'Go to Sessions' },
      { keys: ['G', 'B'], description: 'Go to Branches' },
      { keys: ['G', 'O'], description: 'Go to Settings (Options)' },
    ],
  },
  {
    category: 'General',
    bindings: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close overlay or modal' },
      { keys: ['⌘', '\\'], description: 'Toggle theme (light/dark)' },
      { keys: ['⌘', ','], description: 'Open Settings' },
    ],
  },
  {
    category: 'Actions',
    bindings: [
      { keys: ['⌘', 'N'], description: 'New plugin (in Marketplace)' },
      { keys: ['⌘', 'I'], description: 'Import plugin' },
      { keys: ['⌘', 'E'], description: 'Export plugin' },
      { keys: ['⌘', 'F'], description: 'Search current view' },
    ],
  },
];

export function KeyboardShortcutsOverlay({ open, onClose }: KeyboardShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close keyboard shortcuts overlay"
      />

      {/* Overlay container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <Card className="pointer-events-auto w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
                <p className="text-sm text-muted-foreground">
                  Press <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono">?</kbd> any time to toggle
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {SHORTCUTS.map((section) => (
                <div key={section.category}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{section.category}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {section.bindings.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {section.bindings.map((binding) => (
                      <div
                        key={binding.description}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <span className="text-muted-foreground">{binding.description}</span>
                        <div className="flex items-center gap-1">
                          {binding.keys.map((key, idx) => (
                            <span key={`${binding.description}-${idx}`} className="flex items-center gap-1">
                              <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground">
                                {key}
                              </kbd>
                              {idx < binding.keys.length - 1 && (
                                <span className="text-xs text-muted-foreground">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Workbench is part of the Orqenix knowledge fabric. Learn more at{' '}
                <a href="/docs/keyboard-shortcuts" className="underline underline-offset-2 hover:text-foreground">
                  /docs/keyboard-shortcuts
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
