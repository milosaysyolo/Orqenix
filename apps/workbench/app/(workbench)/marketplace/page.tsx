// SPDX-License-Identifier: Apache-2.0
// W3.A , Marketplace page — Obsidian browse + detail + install flow

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

const KINDS = [
  'knowledge-source', 'embedding-model', 'reranker', 'compression-strategy',
  'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer',
  'kb-schema', 'mcp-server', 'agent', 'subagent', 'skill', 'agent-binding',
];

interface Plugin {
  name: string; version: string; description: string; kind: string; license: string;
  external_agent_compat: string[]; verified: boolean; publisher: string; source: string; installed?: boolean;
}

export default function MarketplacePage() {
  const [tab, setTab] = React.useState<'discover' | 'installed'>('discover');
  const [query, setQuery] = React.useState('');
  const [kind, setKind] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Plugin[]>([]);
  const [installed, setInstalled] = React.useState<Plugin[]>([]);
  const [selected, setSelected] = React.useState<Plugin | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadInstalled = React.useCallback(async () => {
    const res = await api.get<{ plugins: Plugin[] }>('/api/marketplace?action=installed');
    if (res.ok) setInstalled(res.data!.plugins);
  }, []);
  React.useEffect(() => { void loadInstalled(); }, [loadInstalled]);

  async function search() {
    setLoading(true);
    const res = await api.post<{ plugins: Plugin[] }>('/api/marketplace', {
      action: 'search', query, filters: kind ? { kind: [kind] } : undefined,
    });
    setLoading(false);
    if (res.ok) setResults(res.data!.plugins);
  }

  async function install(p: Plugin) {
    await api.post('/api/marketplace', { action: 'install', name: p.name, version: p.version, kind: p.kind });
    await loadInstalled();
    setTab('installed');
  }
  async function uninstall(name: string) {
    await api.post('/api/marketplace', { action: 'uninstall', name });
    await loadInstalled();
  }

  const list = tab === 'discover' ? results : installed;

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Discover plugins, skills, and MCP servers">Marketplace</SectionTitle>
        <div className="flex gap-2">
          <Link href="/marketplace/import"><Button variant="outline" size="sm">Import</Button></Link>
          <Link href="/marketplace/new"><Button variant="primary" size="sm">+ New Plugin</Button></Link>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {(['discover', 'installed'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={'rounded-[9px] px-3 py-1.5 font-mono text-[12px] font-semibold capitalize ' +
              (tab === t ? 'bg-[var(--card)] border border-[var(--line2)] text-[var(--ink)]' : 'text-[var(--dim)]')}>
            {t}{t === 'installed' ? ` (${installed.length})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[190px_1fr_330px] gap-4">
        <Card className="p-3">
          <div className="mb-2 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">Categories</div>
          <button onClick={() => setKind(null)} className={'block w-full rounded px-2 py-1 text-left font-mono text-[11px] ' + (kind === null ? 'text-[var(--rust)] font-bold' : 'text-[var(--dim)]')}>All</button>
          {KINDS.map((k) => (
            <button key={k} onClick={() => setKind(k)} className={'block w-full rounded px-2 py-1 text-left font-mono text-[11px] ' + (kind === k ? 'text-[var(--rust)] font-bold' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>{k}</button>
          ))}
        </Card>

        <div>
          {tab === 'discover' && (
            <div className="mb-3 flex gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="search plugins, skills, MCP servers..."
                className="flex-1 rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
              <Button variant="primary" size="md" onClick={search} disabled={loading}>{loading ? 'searching...' : 'Search'}</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {list.length === 0 ? (
              <div className="col-span-2 py-12 text-center font-mono text-[11px] text-[var(--faint)]">
                {tab === 'discover' ? 'Search to discover plugins.' : 'No plugins installed yet.'}
              </div>
            ) : (
              list.map((p) => (
                <Card key={`${p.source ?? 'local'}:${p.name}`} className="cursor-pointer p-4 transition-colors hover:border-[var(--rust)]" >
                  <button onClick={() => setSelected(p)} className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{p.name}</span>
                      <Badge tone="neutral">v{p.version}</Badge>
                      {p.verified ? <Badge tone="olive">verified</Badge> : <Badge tone="amber">unverified</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[var(--dim)]">{p.description}</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-[var(--faint)]">
                      <Badge tone="plum">{p.kind}</Badge>
                      <span>{p.publisher} · {p.license}</span>
                    </div>
                  </button>
                  <div className="mt-3 flex justify-end">
                    {tab === 'installed' || installed.some((i) => i.name === p.name) ? (
                      <Button variant="danger" size="sm" onClick={() => uninstall(p.name)}>Uninstall</Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => install(p)}>Install</Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <Card className="h-fit p-4">
          {!selected ? (
            <div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Select a plugin to inspect.</div>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-[13px] font-bold text-[var(--ink)]">{selected.name}</div>
              <div className="font-mono text-[10px] text-[var(--dim)]">v{selected.version} · {selected.publisher}</div>
              <p className="text-[12px] text-[var(--dim)]">{selected.description}</p>
              <div>
                <div className="mb-1 font-mono text-[10px] font-bold uppercase text-[var(--faint)]">Compatible with</div>
                <div className="flex flex-wrap gap-1">
                  {selected.external_agent_compat.map((c) => <Badge key={c} tone="teal">{c}</Badge>)}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                {installed.some((i) => i.name === selected.name)
                  ? <Button variant="danger" size="sm" onClick={() => uninstall(selected.name)}>Uninstall</Button>
                  : <Button variant="primary" size="sm" onClick={() => install(selected)}>Install</Button>}
                <Link href={`/marketplace/${encodeURIComponent(selected.name)}`}><Button variant="outline" size="sm">Details</Button></Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
