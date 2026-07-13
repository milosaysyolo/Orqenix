// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// TOAST — native editorial toast system (Response pillar). Replaces the inline
// `note`-state pattern used across the original workbench.
//   - Queue: max 3 visible, auto-dismiss after 4s (or duration).
//   - Tones: success(olive) / error(rust) / info(slate).
//   - Optional `undo` action that calls a provided callback.
//   - Stacked bottom-right, slide-in animation.
// ============================================================================

'use client';

import * as React from 'react';
import { cn } from './ui';

export type ToastTone = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  duration?: number;
  undo?: () => void;
}

interface ToastCtx {
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

const Ctx = React.createContext<ToastCtx | null>(null);

const TONE: Record<ToastTone, { color: string; glyph: string; label: string }> = {
  success: { color: 'var(--olive)', glyph: '\u2713', label: 'success' },
  error: { color: 'var(--rust)', glyph: '\u2715', label: 'error' },
  info: { color: 'var(--slate)', glyph: '\u2139', label: 'info' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++idRef.current;
    const next: Toast = { duration: 4000, ...t, id };
    setToasts((prev) => [...prev, next].slice(-3)); // max 3 visible
    if (next.duration && next.duration > 0) {
      setTimeout(() => dismiss(id), next.duration);
    }
  }, [dismiss]);

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[330px] flex-col gap-2">
        {toasts.map((t) => {
          const tone = TONE[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto animate-slide-in-right overflow-hidden rounded-[10px] border bg-[var(--card)] shadow-[0_12px_30px_rgba(35,36,31,0.12)]"
              style={{ borderColor: `color-mix(in oklab, ${tone.color} 40%, transparent)` }}
            >
              <div className="flex items-start gap-2.5 p-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold"
                  style={{ color: 'var(--paper)', background: tone.color }}>{tone.glyph}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] font-extrabold uppercase tracking-wide" style={{ color: tone.color }}>{t.title}</div>
                  {t.message && <div className="mt-0.5 font-mono text-[11px] leading-snug text-[var(--dim)]">{t.message}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  {t.undo && (
                    <button
                      onClick={() => { t.undo!(); dismiss(t.id); }}
                      className="rounded-[6px] border border-[var(--line2)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--paper2)]"
                    >undo</button>
                  )}
                  <button onClick={() => dismiss(t.id)} className="font-mono text-[11px] text-[var(--faint)] hover:text-[var(--ink)]" aria-label="Dismiss">{'\u00D7'}</button>
                </div>
              </div>
              {t.duration && t.duration > 0 && (
                <div className="h-[2px] w-full" style={{ background: `color-mix(in oklab, ${tone.color} 22%, transparent)` }}>
                  <div className="h-full origin-left" style={{ background: tone.color, animation: 'shrink-bar 4s linear forwards' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes shrink-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/** Convenience helpers for the common optimistic-update pattern. */
export function useOptimisticToast() {
  const { toast } = useToast();
  return React.useCallback((opts: {
    doing: string;
    done: string;
    fail: string;
    run: () => Promise<unknown>;
    undo?: () => void | Promise<void>;
  }) => {
    toast({ tone: 'info', title: opts.doing, duration: 1500 });
    opts.run()
      .then(() => toast({ tone: 'success', title: opts.done, undo: opts.undo }))
      .catch(() => toast({ tone: 'error', title: opts.fail }));
  }, [toast]);
}

export { cn };
