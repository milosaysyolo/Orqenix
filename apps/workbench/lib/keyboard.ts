// SPDX-License-Identifier: Apache-2.0

'use client';

import { useEffect, useRef } from 'react';

export interface KeyHandler {
  /** Lower-case key, e.g. 'k', 'escape', 'enter'. */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  /**
   * Return true to preventDefault + stopPropagation.
   * Return false/undefined to let the browser handle the key normally.
   * Critical for g-prefix keys that should be no-ops when not armed.
   */
  handler: (e: KeyboardEvent) => void | boolean;
}

function matches(e: KeyboardEvent, k: KeyHandler): boolean {
  if (e.repeat) return false;
  const key = e.key.toLowerCase();
  if (key !== k.key) return false;
  const mod = (e.ctrlKey || e.metaKey);
  if (k.ctrl && !mod) return false;
  if (!k.ctrl && mod && !k.meta) return false;
  if (k.meta && !mod) return false;
  if (k.shift !== undefined && e.shiftKey !== k.shift) return false;
  return true;
}

/**
 * Attach a set of global keyboard shortcuts. Ignores keystrokes while the user
 * is typing into an input/textarea/select or has the contentEditable flag set.
 */
export function useHotkeys(handlers: KeyHandler[]) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers; // Always up-to-date, effect never re-runs.

  useEffect(() => {
    const isTyping = (t: EventTarget | null): boolean => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape and the palette toggle should always work, even while typing.
      const allowInField = e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
      if (isTyping(e.target) && !allowInField) return;
      for (const k of handlersRef.current) {
        if (matches(e, k)) {
          const consumed = k.handler(e);
          if (consumed) {
            e.preventDefault();
            e.stopPropagation();
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // Empty deps — only subscribes once.
}
