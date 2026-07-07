// SPDX-License-Identifier: Apache-2.0
// Workbench Marketplace page , full CRUD (replaces D8.α.1 scaffold)

"use client";

import * as React from "react";
import { Plus, Upload } from "lucide-react";
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@orqenix/ui-primitives";
import {
  PluginCard,
  PluginSearch,
  PluginInstaller,
  ImportExportWizard,
  type PluginCardData,
  type MarketplaceSearchFilters,
} from "@orqenix/marketplace-ui";

export default function MarketplacePage(): React.ReactElement {
  const [results, setResults] = React.useState<PluginCardData[]>([]);
  const [installed, setInstalled] = React.useState<PluginCardData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [installerPlugin, setInstallerPlugin] = React.useState<PluginCardData | null>(null);
  const [wizardMode, setWizardMode] = React.useState<"import" | "export" | null>(null);
  const [exportPlugin, setExportPlugin] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    void loadInstalled();
  }, []);

  async function loadInstalled(): Promise<void> {
    const res = await fetch("/api/marketplace?action=installed");
    if (res.ok) {
      const data = (await res.json()) as { plugins: PluginCardData[] };
      setInstalled(data.plugins);
    }
  }

  async function handleSearch(query: string, filters: MarketplaceSearchFilters): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "search", query, filters }),
      });
      if (res.ok) {
        const data = (await res.json()) as { plugins: PluginCardData[] };
        setResults(data.plugins);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall(name: string): Promise<void> {
    await fetch("/api/marketplace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "install", name }),
    });
    await loadInstalled();
  }

  const callbacks = {
    onInstall: async (name: string) => {
      const plugin = results.find((p) => p.name === name);
      if (plugin) setInstallerPlugin(plugin);
    },
    onUninstall: async (name: string) => {
      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "uninstall", name }),
      });
      await loadInstalled();
    },
    onExport: (name: string) => {
      setExportPlugin(name);
      setWizardMode("export");
    },
    onConfigure: (name: string) => {
      window.location.href = `/settings/plugins#${name}`;
    },
    onFork: async (name: string) => {
      const newName = prompt(`Fork ${name} as:`, `@local/${name.split("/").pop()}-fork`);
      if (newName) {
        await fetch("/api/marketplace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "fork", sourceName: name, newName }),
        });
        await loadInstalled();
      }
    },
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Marketplace</h1>
          <p className="text-muted-foreground">Discover, install, create, and manage plugins.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setWizardMode("import")}>
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button
            variant="default"
            className="gap-2"
            onClick={() => {
              window.location.href = "/marketplace/new";
            }}
          >
            <Plus className="w-4 h-4" /> New Plugin
          </Button>
        </div>
      </div>

      <Tabs defaultValue="discover">
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-4 pt-4">
          <PluginSearch onSearch={(q, f) => void handleSearch(q, f)} loading={loading} />
          <div className="space-y-3">
            {results.map((p) => (
              <PluginCard key={`${p.source}:${p.name}`} plugin={p} callbacks={callbacks} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="installed" className="space-y-3 pt-4">
          {installed.map((p) => (
            <PluginCard key={p.name} plugin={{ ...p, installed: true }} callbacks={callbacks} />
          ))}
        </TabsContent>
      </Tabs>

      <PluginInstaller
        open={installerPlugin !== null}
        plugin={
          installerPlugin
            ? {
                name: installerPlugin.name,
                version: installerPlugin.version,
                kind: installerPlugin.kind,
                license: installerPlugin.license,
                permissions: [],
                verified: installerPlugin.verified,
                sandboxMode: "separate_process",
              }
            : null
        }
        onClose={() => setInstallerPlugin(null)}
        onConfirm={handleInstall}
      />

      {wizardMode && (
        <ImportExportWizard
          mode={wizardMode}
          open={true}
          {...(exportPlugin ? { pluginName: exportPlugin } : {})}
          onClose={() => {
            setWizardMode(null);
            setExportPlugin(undefined);
          }}
          onImport={async (input) => {
            const res = await fetch("/api/marketplace", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "import", ...input }),
            });
            const data = (await res.json()) as { ok: boolean; warnings: string[] };
            await loadInstalled();
            return data;
          }}
          onExport={async (input) => {
            const res = await fetch("/api/marketplace", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "export", pluginName: exportPlugin, ...input }),
            });
            return (await res.json()) as { ok: boolean; lossyFields: string[] };
          }}
        />
      )}
    </div>
  );
}
