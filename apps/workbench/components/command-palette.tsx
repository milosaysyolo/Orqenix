// SPDX-License-Identifier: Apache-2.0
// Command palette , Cmd+K navigation across all tabs + actions
// Uses cmdk library

"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Brain,
  Network,
  ShieldCheck,
  Package,
  Sparkles,
  MessageSquare,
  GitBranch,
  Settings,
  Search,
  Plus,
  Download,
  Upload,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (!open) return null;

  const navigateAndClose = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <button
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close command palette"
      />

      {/* Palette container */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <Command
          className="pointer-events-auto w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl overflow-hidden"
          loop
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
            <Search className="w-4 h-4 text-muted-foreground mr-2" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Search for commands, tabs, actions..."
              className="flex h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="ml-2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ESC
            </kbd>
          </div>

          {/* Command list */}
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Top-level tabs */}
            <Command.Group heading="Navigate" className="text-xs text-muted-foreground px-2 py-1.5">
              <Command.Item
                onSelect={() => navigateAndClose("/memory")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Brain className="w-4 h-4" aria-hidden />
                <span>Memory</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/mesh")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Network className="w-4 h-4" aria-hidden />
                <span>Mesh</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/audit")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden />
                <span>Audit</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/marketplace")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Package className="w-4 h-4" aria-hidden />
                <span>Marketplace</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/learning")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Sparkles className="w-4 h-4" aria-hidden />
                <span>Self-Learning</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/sessions")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <MessageSquare className="w-4 h-4" aria-hidden />
                <span>Sessions</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/branches")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <GitBranch className="w-4 h-4" aria-hidden />
                <span>Branches</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings</span>
                <span className="ml-auto text-xs text-muted-foreground">Tab</span>
              </Command.Item>
            </Command.Group>

            {/* Settings sub-tabs */}
            <Command.Group
              heading="Settings"
              className="text-xs text-muted-foreground px-2 py-1.5 mt-2"
            >
              <Command.Item
                onSelect={() => navigateAndClose("/settings/memory")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Memory</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/storage")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Storage</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/search")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Search</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/mesh")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Mesh</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/cloud-sync")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Cloud Sync</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/self-learning")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Self-Learning</span>
              </Command.Item>
              <Command.Item
                onSelect={() => navigateAndClose("/settings/plugins")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="w-4 h-4" aria-hidden />
                <span>Settings → Plugins</span>
              </Command.Item>
            </Command.Group>

            {/* Quick actions */}
            <Command.Group
              heading="Actions"
              className="text-xs text-muted-foreground px-2 py-1.5 mt-2"
            >
              <Command.Item
                onSelect={() => {
                  navigateAndClose("/marketplace");
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Plus className="w-4 h-4" aria-hidden />
                <span>Create new plugin</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  navigateAndClose("/marketplace");
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Upload className="w-4 h-4" aria-hidden />
                <span>Import plugin</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  navigateAndClose("/marketplace");
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Download className="w-4 h-4" aria-hidden />
                <span>Export plugin</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" aria-hidden />
                ) : (
                  <Moon className="w-4 h-4" aria-hidden />
                )}
                <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
              </Command.Item>
            </Command.Group>

            {/* Help */}
            <Command.Group
              heading="Help"
              className="text-xs text-muted-foreground px-2 py-1.5 mt-2"
            >
              <Command.Item
                onSelect={() => {
                  window.open(
                    "https://orqenix.dev/docs/workbench",
                    "_blank",
                    "noopener,noreferrer",
                  );
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent cursor-pointer aria-selected:bg-accent"
              >
                <Zap className="w-4 h-4" aria-hidden />
                <span>Open Workbench docs</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </>
  );
}
