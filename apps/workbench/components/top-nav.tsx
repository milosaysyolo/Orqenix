// SPDX-License-Identifier: Apache-2.0
// Top navigation bar , 8 top-level tabs + project/branch selector + command palette trigger

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Brain,
  Network,
  ShieldCheck,
  Package,
  Sparkles,
  MessageSquare,
  GitBranch,
  Settings,
  Sun,
  Moon,
  Command,
  HelpCircle,
} from 'lucide-react';
import { Button, Badge } from '@orqenix/ui-primitives';

const TOP_TABS = [
  { href: '/memory', label: 'Memory', icon: Brain, badge: null },
  { href: '/mesh', label: 'Mesh', icon: Network, badge: null },
  { href: '/audit', label: 'Audit', icon: ShieldCheck, badge: null },
  { href: '/marketplace', label: 'Marketplace', icon: Package, badge: null },
  { href: '/learning', label: 'Self-Learning', icon: Sparkles, badge: 'active' as const },
  { href: '/sessions', label: 'Sessions', icon: MessageSquare, badge: null },
  { href: '/branches', label: 'Branches', icon: GitBranch, badge: null },
  { href: '/settings', label: 'Settings', icon: Settings, badge: null },
] as const;

interface TopNavProps {
  onOpenCommandPalette: () => void;
}

export function TopNav({ onOpenCommandPalette }: TopNavProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-14 items-center px-6 gap-6">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-orqenix-emerald/15 text-orqenix-emerald font-bold text-lg"
            aria-hidden
          >
            Ω
          </div>
          <span className="font-semibold text-foreground hidden sm:inline">Workbench</span>
        </Link>

        {/* Project / Branch selector */}
        <div className="flex items-center gap-2 text-sm">
          <button
            className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
            aria-label="Select project"
          >
            <span className="text-muted-foreground">Project:</span>
            <span className="font-medium">—</span>
            <span className="text-muted-foreground text-xs">▾</span>
          </button>
          <button
            className="rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
            aria-label="Select branch"
          >
            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            <span className="font-medium">main</span>
            <span className="text-muted-foreground text-xs">▾</span>
          </button>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto" aria-label="Main navigation">
          {TOP_TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap relative transition-colors ${
                  isActive
                    ? 'text-foreground bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <tab.icon className="w-4 h-4" aria-hidden />
                <span className="hidden md:inline">{tab.label}</span>
                {tab.badge === 'active' && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orqenix-emerald"
                    aria-label="active"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenCommandPalette}
            className="gap-2 text-muted-foreground"
            aria-label="Open command palette (Cmd+K)"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-xs font-mono">⌘K</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" aria-hidden />
            ) : (
              <Moon className="w-4 h-4" aria-hidden />
            )}
          </Button>

          <Link
            href="/docs/keyboard-shortcuts"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            aria-label="Help and documentation"
          >
            <HelpCircle className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
