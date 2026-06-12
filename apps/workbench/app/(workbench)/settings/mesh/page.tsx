// SPDX-License-Identifier: Apache-2.0
// Settings → Mesh , transport preferences, capabilities, sharing toggles

'use client';

import { Network, Link2, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Label, Switch } from '@orqenix/ui-primitives';

export default function SettingsMeshPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Mesh</h2>
        <p className="text-sm text-muted-foreground">
          Configure transport preferences, capability tokens, and sharing toggles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" aria-hidden />
              Sharing Toggles
            </CardTitle>
            <Badge variant="outline" className="text-xs">P8 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Cross-session sharing within branch"
            description="Default: opt-out (ON). Parallel sessions on same branch share context."
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Cross-branch sharing within project"
            description="Default: opt-out (ON). Branches within project share consensus context."
            phaseLock="P8"
          >
            <Switch defaultChecked />
          </SettingRow>

          <SettingRow
            label="Cross-project sharing"
            description="Default: opt-in (OFF). Candidates show but never share without approval."
            phaseLock="P8"
          >
            <Switch />
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5" aria-hidden />
              Mesh Transport
            </CardTitle>
            <Badge variant="outline" className="text-xs">P6 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Transport preferences (drag to reorder)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Default: in_process → loopback_http → lan_libp2p
            </p>
            <div className="space-y-2">
              <TransportItem label="in_process" priority={1} />
              <TransportItem label="loopback_http" priority={2} />
              <TransportItem label="lan_libp2p" priority={3} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" aria-hidden />
              Capability Tokens
            </CardTitle>
            <Badge variant="outline" className="text-xs">P6 locked</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingRow
            label="Capability token TTL"
            description="Default 1 hour (3600 seconds)"
            phaseLock="P6"
          >
            <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
              <option>5 minutes</option>
              <option>15 minutes</option>
              <option>30 minutes</option>
              <option selected>1 hour (default)</option>
              <option>4 hours</option>
              <option>24 hours</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Pro: mesh delegation chains"
            description="Phase 6 Pro feature , disabled in OSS"
            phaseLock="P6"
          >
            <Switch disabled />
            <Badge variant="secondary" className="text-xs ml-2">Pro</Badge>
          </SettingRow>

          <SettingRow
            label="Pro: blast radius containment"
            description="Phase 6 Pro feature , quota-based containment"
            phaseLock="P6"
          >
            <Switch disabled />
            <Badge variant="secondary" className="text-xs ml-2">Pro</Badge>
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

function TransportItem({ label, priority }: { label: string; priority: number }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md border border-border bg-card cursor-grab">
      <div className="flex h-6 w-6 items-center justify-center rounded text-xs font-medium bg-secondary">
        {priority}
      </div>
      <span className="text-sm font-mono">{label}</span>
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
