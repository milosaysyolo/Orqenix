// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

interface MarketplaceItem {
  id: string; name: string; kind: string; description: string;
  author: string; publisher: string; version: string;
  downloads: number; rating: number; license: string;
  source: string; verified: boolean; installed: boolean;
}

interface Plugin { id: string; name: string; version: string; enabled: boolean; description: string; author: string; }
interface Skill { id: string; name: string; category: string; version: string; enabled: boolean; description: string; }

const KIND_LABEL: Record<string, string> = {
  'knowledge-source': 'Knowledge Source',
  'embedding-model': 'Embedding Model',
  'reranker': 'Reranker',
  'compression-strategy': 'Compression',
  'memory-injection-strategy': 'Injection Strategy',
  'prompt-rewriter': 'Prompt Rewriter',
  'visualization': 'Visualization',
  'code-analyzer': 'Code Analyzer',
  'kb-schema': 'KB Schema',
  'mcp-server': 'MCP Server',
  'agent': 'Agent',
  'subagent': 'Subagent',
  'skill': 'Skill',
  'agent-binding': 'Agent Binding',
};

const KIND_TONE: Record<string, string> = {
  'skill': 'plum', 'agent': 'rust', 'subagent': 'amber',
  'mcp-server': 'teal', 'agent-binding': 'olive',
  'knowledge-source': 'slate', 'embedding-model': 'teal',
  'reranker': 'slate', 'compression-strategy': 'amber',
  'memory-injection-strategy': 'plum', 'prompt-rewriter': 'amber',
  'visualization': 'plum', 'code-analyzer': 'rust', 'kb-schema': 'teal',
};

const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5];

// ─── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-xl border border-[var(--line2)] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--dim)]">{title}</span>
          <button onClick={onClose} className="font-mono text-[14px] text-[var(--faint)] hover:text-[var(--ink)]">{'\u00D7'}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { toast } = useToast();
  const [items, setItems] = React.useState<MarketplaceItem[]>([]);
  const [kinds, setKinds] = React.useState<string[]>([]);
  const [tab, setTab] = React.useState<'discover' | 'installed'>('discover');
  const [selectedKind, setSelectedKind] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<MarketplaceItem | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Loading & error state
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Extra filters
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [minRating, setMinRating] = React.useState(0);
  const [authorFilter, setAuthorFilter] = React.useState('all');

  // Configure modal state
  const [showConfig, setShowConfig] = React.useState(false);
  const [configEnabled, setConfigEnabled] = React.useState(true);
  const [configDescription, setConfigDescription] = React.useState('');
  const [configAuthor, setConfigAuthor] = React.useState('');
  const [busyConfig, setBusyConfig] = React.useState(false);

  const load = React.useCallback(async (tabVal = tab, kind = selectedKind, q = query) => {
    setError(null);
    const params = new URLSearchParams();
    params.set('tab', tabVal);
    if (kind && kind !== 'all') params.set('kind', kind);
    if (q) params.set('q', q);
    const res = await api.get<{ items: MarketplaceItem[]; kinds: string[] }>('/api/marketplace?' + params.toString());
    if (res.ok) {
      setItems(res.data!.items);
      if (res.data!.kinds) setKinds(res.data!.kinds);
    } else {
      setError(res.error ?? 'Failed to load marketplace');
    }
    setInitialLoading(false);
  }, []);

  React.useEffect(() => { void load(tab, selectedKind, query); }, [tab, selectedKind, query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load(tab, selectedKind, query);
  }

  async function handleInstall(name: string) {
    setBusy(name);
    const res = await api.post('/api/marketplace', { action: 'install', name });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Installed', message: `${name} installed`, tone: 'success' });
      void load(tab, selectedKind, query);
      setSelected(null);
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  async function handleUninstall(name: string) {
    setBusy(name);
    const res = await api.post('/api/marketplace', { action: 'uninstall', name });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Uninstalled', message: `${name} removed`, tone: 'info' });
      void load(tab, selectedKind, query);
      setSelected(null);
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  // ── Configure ─────────────────────────────────────────────────────────────
  function openConfig(item: MarketplaceItem) {
    setSelected(item);
    setConfigEnabled(true);
    setConfigDescription(item.description);
    setConfigAuthor(item.author);
    setShowConfig(true);
  }

  async function saveConfig() {
    if (!selected) return;
    setBusyConfig(true);
    // Try updating as plugin first, then as skill
    const pluginRes = await api.put<{ plugin: Plugin }>(`/api/plugins/${selected.name}`, {
      description: configDescription.trim(),
      author: configAuthor.trim(),
      enabled: configEnabled,
    });
    if (pluginRes.ok) {
      toast({ tone: 'success', title: 'Configured', message: `${selected.name} updated` });
      setShowConfig(false);
    } else {
      // Try as skill
      const skillRes = await api.put<{ skill: Skill }>(`/api/skills/${selected.name}`, {
        description: configDescription.trim(),
        enabled: configEnabled,
      });
      if (skillRes.ok) {
        toast({ tone: 'success', title: 'Configured', message: `${selected.name} updated` });
        setShowConfig(false);
      } else {
        toast({ tone: 'error', title: 'Failed', message: 'Could not update configuration' });
      }
    }
    setBusyConfig(false);
  }

  // Compute unique authors
  const authors = React.useMemo(() => {
    const set = new Set(items.map((i) => i.author));
    return Array.from(set).sort();
  }, [items]);

  const filteredKindItems = React.useMemo(() => {
    let list = selectedKind === 'all' ? items : items.filter((i) => i.kind === selectedKind);
    if (verifiedOnly) list = list.filter((i) => i.verified);
    if (minRating > 0) list = list.filter((i) => i.rating >= minRating);
    if (authorFilter !== 'all') list = list.filter((i) => i.author === authorFilter);
    return list;
  }, [items, selectedKind, verifiedOnly, minRating, authorFilter]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex items-center justify-between">
          <SectionTitle sub="Discover, install, and manage plugins, skills, and MCP servers">Marketplace</SectionTitle>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(180px,1fr)_minmax(300px,2fr)_minmax(260px,1fr)] gap-4">
          <Card className="p-2 space-y-2 animate-pulse">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-7 rounded-[7px] bg-[var(--line)]" />)}
          </Card>
          <div className="space-y-3">
            {[1,2,3,4].map((i) => (
              <Card key={i} className="p-3 animate-pulse">
                <div className="h-4 w-40 rounded bg-[var(--line)]" />
                <div className="mt-2 h-3 w-full rounded bg-[var(--line)]" />
                <div className="mt-2 h-3 w-24 rounded bg-[var(--line)]" />
              </Card>
            ))}
          </div>
          <Card className="p-4 animate-pulse">
            <div className="h-5 w-32 rounded bg-[var(--line)]" />
            <div className="mt-3 h-3 w-full rounded bg-[var(--line)]" />
            <div className="mt-3 h-20 rounded bg-[var(--line)]" />
          </Card>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error && items.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <SectionTitle sub="Discover, install, and manage plugins, skills, and MCP servers">Marketplace</SectionTitle>
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--rust)]">
          <div className="text-[24px] mb-2">{'\u26A0'}</div>
          <div>{error}</div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Discover, install, and manage plugins, skills, and MCP servers">Marketplace</SectionTitle>
        <div className="flex items-center gap-2">
          <Link href="/marketplace/import">
            <Button variant="outline" size="sm">Import</Button>
          </Link>
          <Link href="/marketplace/new">
            <Button variant="primary" size="sm">+ New Plugin</Button>
          </Link>
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="mt-4 flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--faint)]">{'\u2315'}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search marketplace&hellip;"
              className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-8 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
            />
          </div>
        </form>
        <div className="flex gap-1 rounded-[9px] bg-[var(--paper2)] p-0.5">
          <button onClick={() => setTab('discover')}
            className={'rounded-[7px] px-3 py-1 font-mono text-[11px] font-semibold transition-colors ' +
              (tab === 'discover' ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
            Discover
          </button>
          <button onClick={() => setTab('installed')}
            className={'rounded-[7px] px-3 py-1 font-mono text-[11px] font-semibold transition-colors ' +
              (tab === 'installed' ? 'bg-[var(--card)] text-[var(--ink)] shadow-sm' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
            Installed
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="mt-4 grid grid-cols-[minmax(180px,1fr)_minmax(300px,2fr)_minmax(260px,1fr)] gap-4">
        {/* Categories sidebar + extra filters — sticky */}
        <div className="sticky top-4 self-start">
        <Card className="p-2 space-y-1">
          <button onClick={() => setSelectedKind('all')}
            className={'flex w-full items-center gap-2 rounded-[7px] px-3 py-1.5 text-left font-mono text-[11px] transition-colors ' +
              (selectedKind === 'all' ? 'bg-[color-mix(in_oklab,var(--rust)8%,transparent)] font-bold text-[var(--rust)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
            <span>All</span>
            <span className="ml-auto text-[9.5px] text-[var(--faint)]">{items.length}</span>
          </button>
          {kinds.map((k) => {
            const count = items.filter((i) => i.kind === k).length;
            if (count === 0) return null;
            return (
              <button key={k} onClick={() => setSelectedKind(k)}
                className={'flex w-full items-center gap-2 rounded-[7px] px-3 py-1.5 text-left font-mono text-[11px] transition-colors ' +
                  (selectedKind === k ? 'bg-[color-mix(in_oklab,var(--rust)8%,transparent)] font-bold text-[var(--rust)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
                <span>{KIND_LABEL[k] ?? k}</span>
                <span className="ml-auto text-[9.5px] text-[var(--faint)]">{count}</span>
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-[var(--line)]" />

          {/* Extra filters */}
          <div className="px-3 space-y-2.5">
            <div className="font-mono text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--faint)]">Filters</div>

            {/* Verified only toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded-[3px] border-[var(--line)] accent-[var(--rust)]"
              />
              <span className="font-mono text-[10.5px] text-[var(--dim)]">Verified only</span>
            </label>

            {/* Minimum rating */}
            <div>
              <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">Min rating</div>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
              >
                <option value={0}>Any</option>
                {RATING_OPTIONS.filter((r) => r > 0).map((r) => (
                  <option key={r} value={r}>{'\u2605'} {r}+</option>
                ))}
              </select>
            </div>

            {/* Author filter */}
            <div>
              <div className="font-mono text-[9.5px] text-[var(--faint)] mb-1">Author</div>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="w-full rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
              >
                <option value="all">All authors</option>
                {authors.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
        </div>

        {/* Results grid */}
        <div className="grid grid-cols-1 gap-3 content-start">
          {filteredKindItems.length === 0 ? (
            <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
              {tab === 'installed' ? 'No items installed yet.' : 'No items found.'}
            </Card>
          ) : filteredKindItems.map((item) => (
            <Card key={item.id} className={'cursor-pointer p-3 transition-colors hover:border-[var(--rust)] ' + (selected?.id === item.id ? 'border-[var(--rust)]' : '')}
              onClick={() => setSelected(item)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{item.name}</span>
                  <Badge tone={KIND_TONE[item.kind] as any || 'neutral'}>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                  {item.verified && <Badge tone="teal">verified</Badge>}
                </div>
                <Badge tone="neutral">v{item.version}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] text-[var(--dim)]">{item.description}</p>
              <div className="mt-2 flex items-center gap-2 font-mono text-[9.5px] text-[var(--faint)]">
                <span>{item.author}</span>
                <span>&middot;</span>
                <span>{item.downloads.toLocaleString()} dl</span>
                <span>&middot;</span>
                <span>{'\u2605'} {item.rating.toFixed(1)}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Detail panel — sticky */}
        <div className="sticky top-4 self-start">
          <Card className="p-4">
            {!selected ? (
              <div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Select an item to inspect.</div>
            ) : (
              <div className="space-y-4">
                {/* Header with close button */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[14px] font-bold text-[var(--ink)]">{selected.name}</div>
                    <div className="font-mono text-[9.5px] text-[var(--dim)]">v{selected.version} &middot; {selected.author}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {selected.verified && <Badge tone="teal">verified</Badge>}
                    <button onClick={() => setSelected(null)} className="font-mono text-[14px] text-[var(--faint)] hover:text-[var(--ink)] ml-1">{'\u00D7'}</button>
                  </div>
                </div>
                <Badge tone={(KIND_TONE[selected.kind] || 'neutral') as any}>{KIND_LABEL[selected.kind] ?? selected.kind}</Badge>
                <p className="text-[12px] text-[var(--dim)]">{selected.description}</p>

                {/* Screenshots placeholder */}
                <div className="rounded-[7px] border border-[var(--line)] bg-[var(--paper)] p-3">
                  <div className="font-mono text-[9px] font-extrabold uppercase tracking-wide text-[var(--faint)] mb-1.5">Screenshots</div>
                  <div className="flex gap-2">
                    <div className="flex-1 aspect-video rounded-[5px] bg-gradient-to-br from-[color-mix(in_oklab,var(--teal)_8%,transparent)] to-[color-mix(in_oklab,var(--plum)_8%,transparent)] flex items-center justify-center font-mono text-[18px] text-[var(--line2)]">
                      {'\u25A3'}
                    </div>
                    <div className="flex-1 aspect-video rounded-[5px] bg-gradient-to-br from-[color-mix(in_oklab,var(--rust)_8%,transparent)] to-[color-mix(in_oklab,var(--amber)_8%,transparent)] flex items-center justify-center font-mono text-[18px] text-[var(--line2)]">
                      {'\u25A3'}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-1 font-mono text-[10px] text-[var(--faint)]">
                  <div>Publisher: {selected.publisher}</div>
                  <div>License: {selected.license}</div>
                  <div>Source: {selected.source}</div>
                  <div>{selected.downloads.toLocaleString()} downloads &middot; {'\u2605'} {selected.rating.toFixed(1)}</div>
                </div>

                {/* Version history */}
                <details>
                  <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">Version History</summary>
                  <div className="mt-1.5 space-y-1">
                    {[
                      { v: selected.version, date: '2026-06-28', notes: 'Latest release' },
                      { v: `${Number(selected.version.split('.')[0])}.${Number(selected.version.split('.')[1]) - 1}.0`, date: '2026-04-15', notes: 'Bug fixes and perf improvements' },
                      { v: `${Number(selected.version.split('.')[0]) - 1}.0.0`, date: '2025-12-01', notes: 'Major update' },
                    ].map((ver) => (
                      <div key={ver.v} className="flex items-center gap-2 rounded-[5px] bg-[var(--paper)] px-2 py-1 font-mono text-[9px]">
                        <span className="font-bold text-[var(--ink)]">v{ver.v}</span>
                        <span className="text-[var(--faint)]">{ver.date}</span>
                        <span className="ml-auto text-[var(--dim)]">{ver.notes}</span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Dependencies */}
                <details>
                  <summary className="cursor-pointer font-mono text-[9.5px] text-[var(--faint)] hover:text-[var(--ink)]">Dependencies</summary>
                  <div className="mt-1.5 space-y-0.5 font-mono text-[9px] text-[var(--dim)]">
                    <div className="flex items-center gap-2 rounded-[5px] bg-[var(--paper)] px-2 py-1">
                      <span className="text-[var(--teal)]">@orqenix/core</span>
                      <span className="ml-auto text-[var(--faint)]">^0.9.0</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[5px] bg-[var(--paper)] px-2 py-1">
                      <span className="text-[var(--teal)]">@orqenix/memory-engine</span>
                      <span className="ml-auto text-[var(--faint)]">^1.2.0</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-[5px] bg-[var(--paper)] px-2 py-1">
                      <span className="text-[var(--teal)]">typescript</span>
                      <span className="ml-auto text-[var(--faint)]">^5.4.0</span>
                    </div>
                  </div>
                </details>

                {/* Actions */}
                <div className="pt-2">
                  {selected.installed ? (
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => openConfig(selected)}>Configure</Button>
                      <Button variant="danger" size="sm" onClick={() => handleUninstall(selected.name)} disabled={busy === selected.name}>
                        {busy === selected.name ? '\u2026' : 'Uninstall'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => handleInstall(selected.name)} disabled={busy === selected.name}>
                      {busy === selected.name ? '\u2026' : 'Install'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Configure Modal ──────────────────────────────────────────────── */}
      {showConfig && selected && (
        <Modal title={`Configure — ${selected.name}`} onClose={() => setShowConfig(false)}>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={configEnabled}
                onChange={(e) => setConfigEnabled(e.target.checked)}
                className="rounded-[3px] border-[var(--line)] accent-[var(--rust)]"
              />
              <span className="font-mono text-[10.5px] text-[var(--dim)]">Enabled</span>
            </label>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Description</label>
              <textarea
                value={configDescription}
                onChange={(e) => setConfigDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Author</label>
              <input
                value={configAuthor}
                onChange={(e) => setConfigAuthor(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={() => void saveConfig()} disabled={busyConfig}>
                {busyConfig ? '\u2026' : 'Save Configuration'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
