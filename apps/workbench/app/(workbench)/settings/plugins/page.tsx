// SPDX-License-Identifier: Apache-2.0
// Settings → Plugins , sandbox, signing, registry sources

'use client';

import { Package, ShieldCheck, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch } from '@orqenix/ui-primitives';

export default function SettingsPluginsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Plugins</h2>
        <p className="text-sm text-muted-foreground">
          Configure plugin sandbox, signing enforcement, and registry sources.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" aria-hidden />
              Signing Enforcement
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Enforcement level</Label>
            <RadioOption
              id="tiered"
              label="Tiered (recommended)"
              description="Verified plugins shown with badge; unverified installable with warning."
              defaultChecked
            />
            <RadioOption
              id="strict"
              label="Strict"
              description="Only Sigstore-signed plugins. Reject all unverified."
            />
            <RadioOption
              id="permissive"
              label="Permissive"
              description="No signing checks. Not recommended for production."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" aria-hidden />
              Sandbox
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Sandbox mode</Label>
            <RadioOption
              id="separate-process"
              label="Separate process (default, recommended)"
              description="Each plugin runs in its own Node.js process. Crashes isolated."
              defaultChecked
            />
            <RadioOption
              id="wasm"
              label="WebAssembly"
              description="Strong isolation, works with language-portable plugins."
            />
            <RadioOption
              id="in-process"
              label="In-process (trusted only)"
              description="Best performance but no isolation. Use only with fully trusted plugins."
            />
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <SettingRow
              label="Default CPU limit per plugin"
              description="Default 25%"
              phaseLock="P8"
            >
              <span className="text-sm">25%</span>
            </SettingRow>

            <SettingRow
              label="Default memory limit per plugin"
              description="Default 512MB"
              phaseLock="P8"
            >
              <span className="text-sm">512MB</span>
            </SettingRow>

            <SettingRow
              label="Default wall-time limit"
              description="Default 300s per invocation"
              phaseLock="P8"
            >
              <span className="text-sm">300s</span>
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" aria-hidden />
              Registry Sources
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Plugin Registry sources are interchangeable per CR v8.0 Section 6.3.1.
            Enable/disable as needed.
          </p>

          <div className="space-y-4">
            <RegistryItem
              name="orqenix-official"
              url="https://plugins.orqenix.dev"
              description="Curated Orqenix registry (Phase 8.2)"
              enabled
            />
            <RegistryItem
              name="npm"
              url="https://registry.npmjs.org"
              description="Auto-discover packages with orqenixPlugin field"
              enabled
            />
            <RegistryItem
              name="github"
              url="GitHub API"
              description="Search repos with orqenix-plugin topic"
              enabled
            />
            <RegistryItem
              name="local-file"
              url="Local filesystem"
              description="Plugins on disk (development mode)"
              enabled
            />
            <RegistryItem
              name="private-git"
              url="Configurable Git URL with SSH"
              description="Private enterprise registries"
            />
            <RegistryItem
              name="enterprise"
              url="Operator-configured endpoint"
              description="Custom internal registries (extensible)"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RadioOption({
  id,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
      <input
        type="radio"
        id={id}
        name="sandbox-mode"
        defaultChecked={defaultChecked}
        className="mt-1"
      />
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function RegistryItem({
  name,
  url,
  description,
  enabled,
}: {
  name: string;
  url: string;
  description: string;
  enabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium">{name}</span>
          {enabled && (
            <Badge variant="default" className="text-xs">
              Active
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{url}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
      </div>
      <Switch {...(enabled !== undefined ? { defaultChecked: enabled } : {})} />
    </div>
  );
}

function SettingRow({
  label,
  description,
  phaseLock,
  children,
}: {
  label: string;
  description?: string;
  phaseLock?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {phaseLock && (
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {phaseLock}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center shrink-0">{children}</div>
    </div>
  );
}
