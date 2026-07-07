// SPDX-License-Identifier: Apache-2.0
// Settings layout , 7 sub-tabs with Basic/Advanced mode toggle per CR v8.0 Ch 10.9

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Database, Search, Network, Cloud, Sparkles, Package } from "lucide-react";
import { Button, Badge } from "@orqenix/ui-primitives";

const SETTINGS_TABS = [
  { href: "/settings/memory", label: "Memory", icon: Brain, count: 45 },
  { href: "/settings/storage", label: "Storage", icon: Database, count: 25 },
  { href: "/settings/search", label: "Search", icon: Search, count: 15 },
  { href: "/settings/mesh", label: "Mesh", icon: Network, count: 20 },
  { href: "/settings/cloud-sync", label: "Cloud Sync", icon: Cloud, count: 15 },
  { href: "/settings/self-learning", label: "Self-Learning", icon: Sparkles, count: 10 },
  { href: "/settings/plugins", label: "Plugins", icon: Package, count: 15 },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground">
            ~145 configurable parameters across 7 categories. Phase lock badges show provenance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={mode === "basic" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("basic")}
            className="gap-2"
          >
            Basic Mode
          </Button>
          <Button
            variant={mode === "advanced" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("advanced")}
            className="gap-2"
          >
            Advanced Mode
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar with 7 sub-tabs */}
        <aside className="col-span-12 lg:col-span-3">
          <nav className="space-y-1">
            {SETTINGS_TABS.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" aria-hidden />
                  <span className="flex-1">{tab.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tab.count}
                  </Badge>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground px-3 mb-2">
              Mode: <span className="font-medium text-foreground">{mode}</span>
            </p>
            <p className="text-xs text-muted-foreground px-3">
              Showing{" "}
              {mode === "basic" ? "~10-20 most common settings" : "all settings (~145 total)"}
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="col-span-12 lg:col-span-9" data-mode={mode}>
          {children}
        </main>
      </div>
    </div>
  );
}
