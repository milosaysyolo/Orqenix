// SPDX-License-Identifier: Apache-2.0
// Plugin detail , full view of a plugin including manifest + conformance + stats

'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
} from '@orqenix/ui-primitives';

interface ConformanceCheckResult {
  id: string;
  description: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}

interface PluginDetailData {
  name: string;
  version: string;
  kind: string;
  license: string;
  homepage?: string;
  permissions: string[];
  external_agent_compat: string[];
  state: string;
  installedAt: string;
  lastActivatedAt: string | null;
  totalInvocations: number;
  totalErrors: number;
  crashCount: number;
  contentHash: string;
  verificationStatus: string;
  conformance: ConformanceCheckResult[];
}

export interface PluginDetailProps {
  plugin: PluginDetailData;
}

export function PluginDetail({ plugin }: PluginDetailProps) {
  const conformancePassed = plugin.conformance.filter((c) => c.status === 'pass').length;
  const conformanceFailed = plugin.conformance.filter((c) => c.status === 'fail').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            {plugin.name}
            <Badge variant="secondary">v{plugin.version}</Badge>
            <Badge variant="outline">{plugin.kind}</Badge>
            <Badge variant={plugin.state === 'active' ? 'default' : 'secondary'}>
              {plugin.state}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="conformance">
                Conformance
                {conformanceFailed > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-xs">
                    {conformanceFailed}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 pt-2">
              <DetailRow label="License" value={plugin.license} />
              <DetailRow label="Verification" value={plugin.verificationStatus} />
              <DetailRow
                label="Content hash"
                value={<code className="font-mono text-xs">{plugin.contentHash}</code>}
              />
              <DetailRow
                label="Compatible platforms"
                value={plugin.external_agent_compat.join(', ') || 'none'}
              />
              {plugin.homepage && (
                <DetailRow
                  label="Homepage"
                  value={
                    <a href={plugin.homepage} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {plugin.homepage}
                    </a>
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="permissions" className="pt-2">
              <div className="space-y-1">
                {plugin.permissions.map((perm) => (
                  <div key={perm} className="text-sm py-1">
                    <code className="font-mono text-xs">{perm}</code>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="conformance" className="pt-2">
              <div className="flex items-center gap-2 mb-3 text-sm">
                <Badge variant="default">{conformancePassed} passed</Badge>
                {conformanceFailed > 0 && (
                  <Badge variant="destructive">{conformanceFailed} failed</Badge>
                )}
              </div>
              <div className="space-y-2">
                {plugin.conformance.map((check) => (
                  <div key={check.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          check.status === 'pass'
                            ? 'text-status-success'
                            : check.status === 'fail'
                              ? 'text-status-danger'
                              : 'text-orqenix-amber'
                        }
                      >
                        {check.status === 'pass' ? '\u2713' : check.status === 'fail' ? '\u2717' : '\u26A0'}
                      </span>
                      <span>{check.description}</span>
                    </div>
                    {check.message && (
                      <div className="text-xs text-muted-foreground ml-6 mt-0.5">
                        {check.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="stats" className="pt-2 space-y-3">
              <DetailRow label="Installed" value={new Date(plugin.installedAt).toLocaleString()} />
              <DetailRow
                label="Last activated"
                value={
                  plugin.lastActivatedAt
                    ? new Date(plugin.lastActivatedAt).toLocaleString()
                    : 'never'
                }
              />
              <Separator />
              <DetailRow label="Total invocations" value={String(plugin.totalInvocations)} />
              <DetailRow label="Total errors" value={String(plugin.totalErrors)} />
              <DetailRow label="Crash count" value={String(plugin.crashCount)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
