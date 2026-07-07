// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme";
import { useLiveEvents } from "@/lib/use-live-events";

interface NavItem {
  href: string;
  label: string;
  glyph: string;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "WORKSPACE",
    items: [
      { href: "/", label: "Dashboard", glyph: "\u25C8" },
      { href: "/memory", label: "Memory Explorer", glyph: "\u25A4" },
      { href: "/branches", label: "Branches", glyph: "\u2387" },
      { href: "/learning", label: "Learning Hub", glyph: "\u27F2" },
    ],
  },
  {
    title: "AGENTS",
    items: [
      { href: "/agents/orchestrator", label: "Orchestrator", glyph: "\u25C7" },
      { href: "/agents/runner", label: "Agent Runner", glyph: "\u25C9" },
      { href: "/agents/sessions", label: "Sessions", glyph: "\u2261" },
      { href: "/agents/subagents", label: "Subagents", glyph: "\u22C5" },
      { href: "/agents/mcp", label: "MCP Server", glyph: "\u2B21" },
      { href: "/agents/bindings", label: "Bindings", glyph: "\u29C9" },
      { href: "/agents/network", label: "Network", glyph: "\u2317" },
    ],
  },
  {
    title: "ECOSYSTEM",
    items: [
      { href: "/marketplace", label: "Marketplace", glyph: "\u2295" },
      { href: "/plugins", label: "Plugins", glyph: "\u25A3" },
      { href: "/skills", label: "Skills", glyph: "\u2726" },
      { href: "/mesh", label: "Mesh", glyph: "\u2B22" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/audit", label: "Audit", glyph: "\u25D4" },
      { href: "/observability", label: "Observability", glyph: "\u25D1" },
    ],
  },
  {
    title: "CONFIG",
    items: [{ href: "/settings", label: "Settings", glyph: "\u2699" }],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { connected } = useLiveEvents();

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR (this is the navigation between screens) */}
      <aside className="sticky top-0 flex h-screen w-[208px] shrink-0 flex-col overflow-y-auto border-r border-[var(--line)] bg-[var(--paper)] px-2 py-4">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3">
          <span className="block h-3 w-3 rotate-45 rounded-[3px] bg-gradient-to-br from-[var(--rust)] to-[var(--plum)]" />
          <span className="font-mono text-sm font-extrabold tracking-wide text-[var(--ink)]">
            ORQENIX
          </span>
        </Link>

        <nav className="flex-1 space-y-4">
          {NAV.map((group) => (
            <div key={group.title}>
              <div className="px-3 pb-1 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--faint)]">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "flex items-center gap-2 rounded-md border-l-[3px] px-3 py-1.5 font-mono text-[12px] transition-colors " +
                      (active
                        ? "border-[var(--rust)] bg-[color-mix(in_oklab,var(--rust)_8%,transparent)] font-extrabold text-[var(--rust)]"
                        : "border-transparent font-medium text-[var(--dim)] hover:text-[var(--ink)]")
                    }
                  >
                    <span className="w-3.5 text-center opacity-75">{item.glyph}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-6 px-3">
          <div className="rounded-md border border-[var(--line)] bg-[var(--card)] p-3 font-mono text-[10px] text-[var(--dim)]">
            <div className="font-bold text-[var(--ink)]">Orqenix Workbench</div>
            <div className="mt-1">v0.8.0 · OSS</div>
            <div>Apache-2.0</div>
          </div>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] px-5 backdrop-blur">
          <span className="font-mono text-[12px] text-[var(--dim)]">
            orqenix workbench · localhost:27420
          </span>
          <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-[var(--olive)]">
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (connected ? "animate-pulse bg-[var(--olive)]" : "bg-[var(--faint)]")
              }
            />
            {connected ? "live" : "connecting\u2026"}
          </span>
          <ThemeToggle />
          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--dim)]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--paper2)]">
              m
            </span>
            milo
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
