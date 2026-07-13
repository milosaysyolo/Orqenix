// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// COMMAND PALETTE — native editorial (Interaction pillar). Opened via Cmd/Ctrl+K.
// Fuzzy filter over navigation + quick actions. Dependency-free (no cmdk).
// ============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Kbd } from './ui';

interface Command { id: string; label: string; hint: string; group: string; run: () => void; }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const nav = (path: string) => () => { router.push(path); onClose(); };

  const commands: Command[] = React.useMemo(() => {
    const themeToggle = () => {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      onClose();
    };
    return [
      { id: 'go-dash', label: 'Dashboard', hint: 'Workspace', group: 'Navigate', run: nav('/') },
      { id: 'go-mem', label: 'Memory Explorer', hint: 'Workspace', group: 'Navigate', run: nav('/memory') },
      { id: 'go-branch', label: 'Branches', hint: 'Workspace', group: 'Navigate', run: nav('/branches') },
      { id: 'go-learn', label: 'Learning Hub', hint: 'Workspace', group: 'Navigate', run: nav('/learning') },
      { id: 'go-orch', label: 'Orchestrator', hint: 'Agents', group: 'Navigate', run: nav('/agents/orchestrator') },
      { id: 'go-sess', label: 'Sessions', hint: 'Agents', group: 'Navigate', run: nav('/sessions') },
      { id: 'go-net', label: 'Agent Network', hint: 'Agents', group: 'Navigate', run: nav('/agents/network') },
      { id: 'go-mkt', label: 'Marketplace', hint: 'Ecosystem', group: 'Navigate', run: nav('/marketplace') },
      { id: 'go-plug', label: 'Plugins', hint: 'Ecosystem', group: 'Navigate', run: nav('/plugins') },
      { id: 'go-skills', label: 'Skills', hint: 'Ecosystem', group: 'Navigate', run: nav('/skills') },
      { id: 'go-mesh', label: 'Mesh', hint: 'Ecosystem', group: 'Navigate', run: nav('/mesh') },
      { id: 'go-audit', label: 'Audit', hint: 'Operations', group: 'Navigate', run: nav('/audit') },
      { id: 'go-obs', label: 'Observability', hint: 'Operations', group: 'Navigate', run: nav('/observability') },
      { id: 'go-set', label: 'Settings', hint: 'Config', group: 'Navigate', run: nav('/settings') },
      { id: 'act-theme', label: 'Toggle theme (light / dark)', hint: 'Action', group: 'Actions', run: themeToggle },
      { id: 'act-resume', label: 'Resume paused session', hint: 'Action', group: 'Actions', run: nav('/sessions') },
    ];
  }, [onClose]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => (c.label + ' ' + c.group + ' ' + c.hint).toLowerCase().includes(s));
  }, [q, commands]);

  React.useEffect(() => {
    if (open) {
      setQ(''); setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  React.useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]">
      <button className="fixed inset-0 bg-[rgba(35,36,31,0.32)] backdrop-blur-[2px]" onClick={onClose} aria-label="Close command palette" />
      <div className="relative w-full max-w-[620px] animate-scale-in overflow-hidden rounded-[13px] border border-[var(--line2)] bg-[var(--card)] shadow-[0_24px_60px_rgba(35,36,31,0.22)]">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
          <span className="font-mono text-[12px] text-[var(--rust)]">{'\u203A'}</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder="Search commands, screens, actions…"
            className="h-12 flex-1 bg-transparent font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[44vh] overflow-y-auto scroll-thin p-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center font-mono text-[12px] text-[var(--faint)]">No matches.</div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--faint)]">{group}</div>
              {items.map((c) => {
                flatIdx += 1;
                const active = flatIdx === sel;
                const idx = flatIdx;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setSel(idx)}
                    onClick={c.run}
                    className={'flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left font-mono text-[12px] transition-colors ' + (active ? 'bg-[color-mix(in_oklab,var(--rust)_9%,transparent)] text-[var(--ink)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}
                  >
                    <span className="flex-1 font-semibold">{c.label}</span>
                    <span className="text-[10px] text-[var(--faint)]">{c.hint}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-2 font-mono text-[10px] text-[var(--faint)]">
          <span className="flex items-center gap-1"><Kbd>{'\u2191'}</Kbd><Kbd>{'\u2193'}</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>{'\u21B5'}</Kbd> select</span>
        </div>
      </div>
    </div>
  );
}
