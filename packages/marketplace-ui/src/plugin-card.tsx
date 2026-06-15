// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , PluginCard component

'use client';

import * as React from 'react';
import { CheckCircle2, AlertTriangle, Download, Settings, Trash2, GitFork, Upload } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@orqenix/ui-primitives';
import type { PluginCardData, MarketplaceUiCallbacks } from './types';

const KIND_GROUP: Record<string, 'Knowledge' | 'Agent'> = {
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

export interface PluginCardProps {
  plugin: PluginCardData;
  callbacks: MarketplaceUiCallbacks;
}

export function PluginCard({ plugin, callbacks }: PluginCardProps): React.ReactElement {
  const group = KIND_GROUP[plugin.kind] ?? 'Knowledge';
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{plugin.name}</span>
              <Badge variant="secondary" className="text-xs">v{plugin.version}</Badge>
              <Badge variant="outline" className="text-xs">{group} · {plugin.kind}</Badge>
              {plugin.verified ? (
                <Badge variant="default" className="text-xs gap-1">
                  <CheckCircle2 className="w-3 h-3" aria-hidden /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" aria-hidden /> Unverified
                </Badge>
              )}
              {plugin.installed && (
                <Badge variant="default" className="text-xs">Installed</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plugin.description}</p>
            <div className="text-xs text-muted-foreground mt-1">
              {plugin.publisher} · {plugin.source} · {plugin.license}
              {plugin.external_agent_compat.length > 0 && (
                <> · Compatible: {plugin.external_agent_compat.join(', ')}</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {plugin.installed ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => callbacks.onConfigure?.(plugin.name)} aria-label="Configure">
                  <Settings className="w-4 h-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => callbacks.onExport?.(plugin.name)} aria-label="Export">
                  <Upload className="w-4 h-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => callbacks.onFork?.(plugin.name)} aria-label="Fork">
                  <GitFork className="w-4 h-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => callbacks.onUninstall?.(plugin.name)} aria-label="Uninstall">
                  <Trash2 className="w-4 h-4" aria-hidden />
                </Button>
              </>
            ) : (
              <Button
                variant={plugin.verified ? 'default' : 'outline'}
                size="sm"
                onClick={() => callbacks.onInstall?.(plugin.name)}
                className="gap-1"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                {plugin.verified ? 'Install' : 'Install (unverified)'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
