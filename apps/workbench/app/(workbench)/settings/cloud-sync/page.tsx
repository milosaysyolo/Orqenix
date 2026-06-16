// SPDX-License-Identifier: Apache-2.0
// Settings → Cloud Sync , configure optional Cloud Tier connection

'use client';

import { Cloud, RefreshCw, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Label, Switch } from '@orqenix/ui-primitives';

export default function SettingsCloudSyncPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Cloud Sync</h2>
        <p className="text-sm text-muted-foreground">
          Optional Cloud Tier connection for cross-machine mesh + Web Control Plane.
          OSS users can fully function without this.
        </p>
      </div>

      <Card className="border-orqenix-violet/30 bg-orqenix-violet/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-orqenix-violet mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Cloud Sync is optional
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Workbench is local-first by default. Connect to Orqenix Cloud Tier (or self-hosted
                operator) only if you need cross-machine mesh, OAuth identity bridge, or
                Web Control Plane. See{' '}
                <a href="https://orqenix.dev/docs/cloud-onboarding" className="underline underline-offset-2 hover:text-foreground">
                  Cloud onboarding guide
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" aria-hidden />
              Connection
            </CardTitle>
            <Badge variant="secondary" className="text-xs">Not connected</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cloud-endpoint">Cloud endpoint URL</Label>
            <Input
              id="cloud-endpoint"
              type="url"
              placeholder="https://cloud.orqenix.dev"
              defaultValue=""
            />
            <p className="text-xs text-muted-foreground">
              Orqenix Cloud SaaS or self-hosted instance
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-org">GitHub organization (optional)</Label>
            <Input
              id="github-org"
              type="text"
              placeholder="my-org-name"
              defaultValue=""
            />
            <p className="text-xs text-muted-foreground">
              Used by Cloud for OAuth identity bridge
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sign in via GitHub OAuth
            </Button>
            <Button variant="outline">Test Connection</Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Cloud auth integration ships in D8.α.7. This page is a scaffold for the connection UI.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" aria-hidden />
              Sync Settings
            </CardTitle>
            <Badge variant="outline" className="text-xs">P7 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Auto-sync enabled"
            description="Sync to Cloud automatically when changes occur"
            phaseLock="P7"
          >
            <Switch disabled />
          </SettingRow>

          <SettingRow
            label="Heartbeat interval"
            description="Default 25 seconds"
            phaseLock="P7"
          >
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" disabled>
              <option>5 seconds</option>
              <option>10 seconds</option>
              <option selected>25 seconds (default)</option>
              <option>60 seconds</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Sampling head percent (prod)"
            description="OTLP sampling rate, default 5%"
            phaseLock="P7"
          >
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" disabled>
              <option>1%</option>
              <option selected>5% (default)</option>
              <option>10%</option>
              <option>25%</option>
              <option>50%</option>
              <option>100%</option>
            </select>
          </SettingRow>
        </CardContent>
      </Card>
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
