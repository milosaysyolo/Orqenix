// SPDX-License-Identifier: Apache-2.0
// Workbench main shell , wraps top-level tabs with TopNav + CommandPalette + keyboard layer

'use client';

import { useEffect, useState } from 'react';
import { TopNav } from './top-nav';
import { CommandPalette } from './command-palette';
import { KeyboardShortcutsOverlay } from './keyboard-shortcuts-overlay';

interface WorkbenchShellProps {
  children: React.ReactNode;
}

export function WorkbenchShell({ children }: WorkbenchShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOverlayOpen, setShortcutsOverlayOpen] = useState(false);

  // Global keyboard shortcuts (Cmd+K, Cmd+/, ?)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K , open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // ? , open keyboard shortcuts overlay (only when not typing)
      if (e.key === '?' && !isTypingInInput(e.target)) {
        e.preventDefault();
        setShortcutsOverlayOpen((prev) => !prev);
        return;
      }

      // Esc , close overlays
      if (e.key === 'Escape') {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (shortcutsOverlayOpen) {
          setShortcutsOverlayOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, shortcutsOverlayOpen]);

  return (
    <div className="workbench-shell">
      {/* Skip link for a11y */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <TopNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

      <main id="main-content" className="workbench-content overflow-y-auto" role="main">
        {children}
      </main>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <KeyboardShortcutsOverlay
        open={shortcutsOverlayOpen}
        onClose={() => setShortcutsOverlayOpen(false)}
      />
    </div>
  );
}

function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}
