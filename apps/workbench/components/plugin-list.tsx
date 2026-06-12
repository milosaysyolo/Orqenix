// SPDX-License-Identifier: Apache-2.0
// Plugin list , shows installed plugins with state + actions

'use client';

import * as React from 'react';
import { Package, Power, Settings as SettingsIcon, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@orqenix/ui-primitives';

interface PluginListItem {
  name: string;
  version: string;
  kind: string;
  state: 'installed' | 'configured' | 'active' | 'inactive' | 'crashed';
  isVerified: boolean;
  crashCount: number;
  totalInvocations: number;
}

export interface PluginListProps {
  plugins: PluginListItem[];
  onActivate?: (name: string) => Promise<void>;
  onDeactivate?: (name: string) => Promise<void>;
  onConfigure?: (name: string) => void;
  onUninstall?: (name: string) => Promise<void>;
}

const KIND_GROUPS: Record<string, string> = {
  'knowledge-source': 'Knowledge',
  'embedding-model': 'Knowledge',
  reranker: 'Knowledge',
  'compression-strategy': 'Knowledge',
  'memory-injection-strategy': 'Knowledge',
  'prompt-rewriter': 'Knowledge',
  visualization: 'Knowledge',
  'code-analyzer': 'Knowledge',
  'kb-schema': 'Knowledge',
  'mcp-server': 'Agent',
  agent: 'Agent',
  subagent: 'Agent',
  skill: 'Agent',
  'agent-binding': 'Agent',
};

export function PluginList({
  plugins,
  onActivate,
  onDeactivate,
  onConfigure,
  onUninstall,
}: PluginListProps) {
  if (plugins.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-40" aria-hidden />
        No plugins installed. Browse the Marketplace to discover plugins.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plugins.map((plugin) => (
        <Card key={plugin.name}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{plugin.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    v{plugin.version}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {KIND_GROUPS[plugin.kind] ?? '?'} · {plugin.kind}
                  </Badge>
                  <PluginStateBadge state={plugin.state} />
                  {plugin.isVerified ? (
                    <Badge variant="default" className="text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" aria-hidden /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" aria-hidden /> Unverified
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {plugin.totalInvocations} invocations
                  {plugin.crashCount > 0 && (
                    <span className="text-status-warning ml-2">
                      · {plugin.crashCount} crash{plugin.crashCount > 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {plugin.state === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onDeactivate?.(plugin.name)}
                    className="gap-1"
                  >
                    <Power className="w-3.5 h-3.5" aria-hidden /> Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void onActivate?.(plugin.name)}
                    className="gap-1"
                    disabled={plugin.state === 'crashed' && plugin.crashCount >= 3}
                  >
                    <Power className="w-3.5 h-3.5" aria-hidden /> Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfigure?.(plugin.name)}
                  aria-label="Configure"
                >
                  <SettingsIcon className="w-4 h-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onUninstall?.(plugin.name)}
                  aria-label="Uninstall"
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PluginStateBadge({ state }: { state: PluginListItem['state'] }) {
  const variant =
    state === 'active'
      ? 'default'
      : state === 'crashed'
        ? 'destructive'
        : 'secondary';
  return (
    <Badge variant={variant} className="text-xs">
      {state}
    </Badge>
  );
}
