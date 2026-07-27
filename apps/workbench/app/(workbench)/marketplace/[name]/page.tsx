// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

interface MarketplaceItem {
  id: string; name: string; kind: string; description: string;
  author: string; publisher: string; version: string;
  downloads: number; rating: number; license: string;
  source: string; verified: boolean; installed: boolean;
}

const KIND_LABEL: Record<string, string> = {
  'knowledge-source': 'Knowledge Source', 'embedding-model': 'Embedding Model',
  'reranker': 'Reranker', 'compression-strategy': 'Compression',
  'memory-injection-strategy': 'Injection Strategy', 'prompt-rewriter': 'Prompt Rewriter',
  'visualization': 'Visualization', 'code-analyzer': 'Code Analyzer',
  'kb-schema': 'KB Schema', 'mcp-server': 'MCP Server',
  'agent': 'Agent', 'subagent': 'Subagent', 'skill': 'Skill', 'agent-binding': 'Agent Binding',
};

export default function PluginDetailPage() {
  const params = useParams();
  const name = params.name as string;
  const { toast } = useToast();
  const [item, setItem] = React.useState<MarketplaceItem | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      const res = await api.get<{ items: MarketplaceItem[] }>('/api/marketplace');
      if (res.ok) {
        const found = res.data!.items.find((i) => i.name === name);
        if (found) setItem(found);
      }
    }
    void load();
  }, [name]);

  async function handleInstall() {
    if (!item) return;
    setBusy(true);
    const res = await api.post('/api/marketplace', { action: 'install', name: item.name });
    setBusy(false);
    if (res.ok) {
      toast({ title: 'Installed', tone: 'success', message: `${item.name} installed` });
      setItem({ ...item, installed: true });
    } else {
      toast({ title: 'Failed', tone: 'error', message: res.error ?? 'unknown' });
    }
  }

  async function handleUninstall() {
    if (!item) return;
    setBusy(true);
    const res = await api.post('/api/marketplace', { action: 'uninstall', name: item.name });
    setBusy(false);
    if (res.ok) {
      toast({ title: 'Uninstalled', tone: 'info', message: `${item.name} removed` });
      setItem({ ...item, installed: false });
    } else {
      toast({ title: 'Failed', tone: 'error', message: res.error ?? 'unknown' });
    }
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-6">
        <div className="flex items-center gap-3">
          <Link href="/marketplace" className="font-mono text-[12px] text-[var(--dim)] hover:text-[var(--ink)]">{'\u2190'} Marketplace</Link>
        </div>
        <div className="mt-10 text-center font-mono text-[11px] text-[var(--faint)]">Loading&hellip;</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/marketplace" className="font-mono text-[12px] text-[var(--dim)] hover:text-[var(--ink)]">{'\u2190'} Marketplace</Link>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_260px] gap-6">
        <div>
          <SectionTitle sub={`v${item.version} by ${item.author}`}>{item.name}</SectionTitle>

          <Card className="mt-4 p-4">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{KIND_LABEL[item.kind] ?? item.kind}</Badge>
              {item.verified && <Badge tone="teal">Orqenix Verified</Badge>}
              <Badge tone={item.installed ? 'olive' : 'neutral'}>{item.installed ? 'installed' : 'not installed'}</Badge>
            </div>
            <p className="mt-3 text-[13px] text-[var(--dim)] leading-relaxed">{item.description}</p>
          </Card>

          <Card className="mt-3 p-4">
            <div className="font-mono text-[11px] font-bold text-[var(--ink)]">Details</div>
            <div className="mt-2 space-y-1.5 font-mono text-[10.5px] text-[var(--dim)]">
              <div>Publisher: <span className="text-[var(--ink)]">{item.publisher}</span></div>
              <div>License: <span className="text-[var(--ink)]">{item.license}</span></div>
              <div>Source: <span className="text-[var(--ink)]">{item.source}</span></div>
              <div>Downloads: <span className="text-[var(--ink)]">{item.downloads.toLocaleString()}</span></div>
              <div>Rating: <span className="text-[var(--ink)]">{'\u2605'} {item.rating.toFixed(1)}</span></div>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="font-mono text-[11px] font-bold text-[var(--ink)]">Actions</div>
            <div className="mt-3 space-y-2">
              {item.installed ? (
                <>
                  <Button variant="primary" size="sm" className="w-full" disabled>Configure</Button>
                  <Button variant="danger" size="sm" className="w-full" onClick={handleUninstall} disabled={busy}>
                    {busy ? '\u2026' : 'Uninstall'}
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="sm" className="w-full" onClick={handleInstall} disabled={busy}>
                  {busy ? '\u2026' : 'Install'}
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-mono text-[11px] font-bold text-[var(--ink)]">Export</div>
            <div className="mt-3 space-y-2">
              <Button variant="outline" size="sm" className="w-full">Export as JSON</Button>
              <Button variant="ghost" size="sm" className="w-full">Fork Plugin</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
