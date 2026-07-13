// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// APP SHELL — the chrome that wraps every screen: sidebar nav, top status bar,
// the live EventTimelineBar, the command palette and shortcuts overlay, and the
// global keyboard layer.
//
// The sidebar can be collapsed to 56px (glyph-only), toggled via the chevron
// button at the bottom. Preference is persisted to localStorage.
// ============================================================================

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from './theme';
import { useLiveEvents } from '@/lib/use-live-events';
import { useHotkeys, type KeyHandler } from '@/lib/keyboard';
import { CommandPalette } from './command-palette';
import { KeyboardShortcutsOverlay } from './keyboard-shortcuts-overlay';
import { EventTimelineBar } from './live/event-timeline-bar';
import { SeedButton } from './seed-button';
import { Kbd } from './ui';

interface NavItem { href: string; label: string; glyph: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    title: 'WORKSPACE',
    items: [
      { href: '/', label: 'Dashboard', glyph: '\u25C8' },
      { href: '/memory', label: 'Memory Explorer', glyph: '\u25A4' },
      { href: '/branches', label: 'Branches', glyph: '\u2387' },
      { href: '/learning', label: 'Learning Hub', glyph: '\u27F2' },
    ],
  },
  {
    title: 'AGENTS',
    items: [
      { href: '/agents/orchestrator', label: 'Orchestrator', glyph: '\u25C7' },
      { href: '/sessions', label: 'Sessions', glyph: '\u2261' },
      { href: '/agents/subagents', label: 'Agents', glyph: '\u22C5' },
      { href: '/agents/mcp', label: 'MCP Server', glyph: '\u2B21' },
      { href: '/agents/bindings', label: 'Bindings', glyph: '\u29C9' },
      { href: '/agents/network', label: 'Network', glyph: '\u2317' },
    ],
  },
  {
    title: 'ECOSYSTEM',
    items: [
      { href: '/marketplace', label: 'Marketplace', glyph: '\u2295' },
      { href: '/plugins', label: 'Plugins', glyph: '\u25A3' },
      { href: '/skills', label: 'Skills', glyph: '\u2726' },
      { href: '/mesh', label: 'Mesh', glyph: '\u2B22' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { href: '/audit', label: 'Audit', glyph: '\u25D4' },
      { href: '/observability', label: 'Observability', glyph: '\u25D1' },
      { href: '/cross-project', label: 'Cross-Project', glyph: '\u29C8' },
    ],
  },
  {
    title: 'CONFIG',
    items: [{ href: '/settings', label: 'Settings', glyph: '\u2699' }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { connected } = useLiveEvents();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  // Sidebar collapse state — persisted to localStorage.
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('orqenix:sidebarCollapsed') === 'true';
  });
  // Hover auto-expand: when collapsed, hovering the sidebar temporarily expands it.
  const [sidebarHovered, setSidebarHovered] = React.useState(false);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('orqenix:sidebarCollapsed', String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const effectiveCollapsed = sidebarCollapsed && !sidebarHovered;
  const SW = effectiveCollapsed ? 56 : 208;

  // g-prefix navigation
  const gArmed = React.useRef(false);
  const gTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const armG = React.useCallback(() => {
    gArmed.current = true;
    clearTimeout(gTimer.current);
    gTimer.current = setTimeout(() => { gArmed.current = false; }, 1200);
  }, []);
  const disarmG = React.useCallback(() => { gArmed.current = false; clearTimeout(gTimer.current); }, []);

  const go = (path: string) => router.push(path);

  const gNav = React.useCallback((key: string, path: string) => {
    if (gArmed.current) { disarmG(); go(path); return true; }
    return false;
  }, [disarmG, go]);

  const handlers: KeyHandler[] = React.useMemo(() => [
    { key: 'k', ctrl: true, handler: () => { setPaletteOpen((o) => !o); return true; } },
    { key: '?', handler: () => { setShortcutsOpen((o) => !o); return true; } },
    { key: '/', handler: () => { setPaletteOpen(true); return true; } },
    { key: '\\', ctrl: true, handler: () => {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      return true;
    } },
    { key: 'escape', handler: () => { setPaletteOpen(false); setShortcutsOpen(false); return true; } },
    { key: 'g', handler: () => { armG(); return true; } },
    { key: 'd', handler: () => gNav('d', '/') },
    { key: 'm', handler: () => gNav('m', '/memory') },
    { key: 'o', handler: () => gNav('o', '/agents/orchestrator') },
    { key: 'r', handler: () => gNav('r', '/agents/runner') },
    { key: 's', handler: () => gNav('s', '/sessions') },
    { key: 'n', handler: () => gNav('n', '/agents/network') },
    { key: 'p', handler: () => gNav('p', '/marketplace') },
    { key: 'x', handler: () => gNav('x', '/mesh') },
    { key: 'a', handler: () => gNav('a', '/audit') },
    { key: 'l', handler: () => gNav('l', '/learning') },
    { key: 'b', handler: () => gNav('b', '/branches') },
    { key: ',', handler: () => gNav(',', '/settings') },
  ], [armG, gNav]);

  useHotkeys(handlers);

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside
        className="sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto scroll-thin border-r border-[var(--line)] bg-[var(--paper)] px-2 py-4 transition-all duration-200"
        style={{ width: SW }}
        onMouseEnter={() => {
          if (sidebarCollapsed) {
            clearTimeout(hoverTimer.current);
            setSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (sidebarCollapsed) {
            hoverTimer.current = setTimeout(() => setSidebarHovered(false), 400);
          }
        }}
      >
        {/* Logo + Collapse toggle row */}
        <div className={`mb-5 flex items-center ${effectiveCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
          <Link href="/" className={`flex items-center ${effectiveCollapsed ? 'justify-center px-0' : 'gap-2 px-3'}`}>
            <span className="block h-3 w-3 shrink-0 rotate-45 rounded-[3px] bg-gradient-to-br from-[var(--rust)] to-[var(--plum)]" />
            {!effectiveCollapsed && (
              <span className="font-mono text-sm font-extrabold tracking-wide text-[var(--ink)]">ORQENIX</span>
            )}
          </Link>
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar (hover edge)' : 'Collapse sidebar'}
            className="flex items-center justify-center rounded-[6px] border border-[var(--line)] px-1.5 py-1 font-mono text-[11px] text-[var(--faint)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            {effectiveCollapsed ? '\u2192' : '\u2190'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4">
          {NAV.map((group) => (
            <div key={group.title}>
              {!effectiveCollapsed && (
                <div className="px-3 pb-1 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--faint)]">{group.title}</div>
              )}
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={effectiveCollapsed ? item.label : undefined}
                    className={
                      'relative flex items-center rounded-[7px] px-3 py-1.5 font-mono text-[12px] transition-all duration-150 ' +
                      (effectiveCollapsed ? 'justify-center' : 'gap-2.5') +
                      (active
                        ? ' bg-[color-mix(in_oklab,var(--rust)_10%,transparent)] font-bold text-[var(--ink)]'
                        : ' font-medium text-[var(--dim)] hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] hover:text-[var(--ink)]')
                    }
                  >
                    {/* Active indicator dot */}
                    {active && (
                      <span className="absolute -left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--rust)] transition-all duration-150" />
                    )}
                    <span className={`${effectiveCollapsed ? 'w-auto' : 'w-3.5'} text-center ${active ? 'opacity-100 text-[var(--rust)]' : 'opacity-60'}`}>{item.glyph}</span>
                    {!effectiveCollapsed && (
                      <span className={active ? '' : 'opacity-80'}>{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Shortcuts button */}
        {effectiveCollapsed ? (
          <button
            onClick={() => setShortcutsOpen(true)}
            title="Shortcuts"
            className="mx-2 flex items-center justify-center rounded-md border border-[var(--line)] px-2 py-2 font-mono text-[10px] text-[var(--dim)] hover:text-[var(--ink)]"
          >
            <Kbd>?</Kbd>
          </button>
        ) : (
          <button
            onClick={() => setShortcutsOpen(true)}
            className="mx-2 flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2 font-mono text-[10px] text-[var(--dim)] hover:text-[var(--ink)]"
          >
            <span>Shortcuts</span>
            <span className="flex items-center gap-1"><Kbd>?</Kbd></span>
          </button>
        )}

        {/* Version info */}
        {effectiveCollapsed ? (
          <div className="mt-3 flex justify-center px-3">
            <div className="rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-2 text-center font-mono text-[9px] text-[var(--faint)]">
              v0.9
            </div>
          </div>
        ) : (
          <div className="mt-3 px-3">
            <div className="rounded-md border border-[var(--line)] bg-[var(--card)] p-3 font-mono text-[10px] text-[var(--dim)]">
              <div className="font-bold text-[var(--ink)]">Orqenix Workbench</div>
              <div className="mt-1">v0.9.0 · rebuild</div>
              <div>Apache-2.0</div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] px-5 backdrop-blur">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-[9px] border border-[var(--line2)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px] text-[var(--faint)] transition-colors hover:text-[var(--ink)]"
          >
            <span className="text-[var(--rust)]">{'\u203A'}</span>
            jump to… <span className="flex items-center gap-1"><Kbd>{'\u2318'}</Kbd><Kbd>K</Kbd></span>
          </button>

          <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-[var(--olive)]">
            <span className={'h-1.5 w-1.5 rounded-full ' + (connected ? 'animate-pulse bg-[var(--olive)]' : 'bg-[var(--faint)]')} />
            {connected ? 'live' : 'connecting\u2026'}
          </span>
          <SeedButton />
          <span className="font-mono text-[11px] text-[var(--dim)]">localhost:27420</span>
          <ThemeToggle />
          <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--dim)]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--paper2)]">m</span>
            milo
          </span>
        </header>

        {/* <EventTimelineBar /> */}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
