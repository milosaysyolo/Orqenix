'use client';

import * as React from 'react';
import { SectionTitle, Button, Card, Badge } from '@/components/ui';
import { CollapseToggle } from '@/components/collapse-toggle';
import { MemoryGraph } from '@/components/canvas/memory-graph';
import { LibraryRail } from '@/components/memory/library-rail';
import { EntryDetail } from '@/components/memory/entry-detail';
import { api } from '@/lib/api';
import type { GraphNode, GraphEdge, KbKind, MemoryEntry, Branch, MemoryLevel, Tier } from '@/lib/demo-store';

type View = 'graph' | 'timeline' | 'files' | 'matrix';

const VIEW_META: Record<View, { label: string; icon: string; desc: string }> = {
  graph: { label: 'Graph', icon: '△', desc: 'Knowledge graph view' },
  timeline: { label: 'Timeline', icon: '≡', desc: 'Entries by time' },
  files: { label: 'Files', icon: '☰', desc: 'File tree view' },
  matrix: { label: 'Matrix', icon: '▦', desc: 'Tier × KB heat-map' },
};

const TIERS: Tier[] = ['T1', 'T2', 'T3', 'T4'];
const KBS: KbKind[] = ['chat', 'code', 'decision', 'lesson'];
const LEVELS: MemoryLevel[] = ['session', 'branch', 'project'];
const KB_TONE: Record<KbKind, 'amber' | 'teal' | 'plum' | 'slate'> = { chat: 'amber', code: 'teal', decision: 'plum', lesson: 'slate' };

interface Filters {
  tiers: Tier[];
  kbs: KbKind[];
  levels: MemoryLevel[];
  branchId: string | null;
}

const EMPTY_FILTERS: Filters = { tiers: [], kbs: [], levels: [], branchId: null };

export default function MemoryExplorerPage() {
  const [view, setView] = React.useState<View>('graph');
  const [graph, setGraph] = React.useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [entries, setEntries] = React.useState<MemoryEntry[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [selected, setSelected] = React.useState<{ id: string; kb: KbKind } | null>(null);
  const [libRefresh, setLibRefresh] = React.useState(0);
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const queryString = React.useMemo(() => {
    const p = new URLSearchParams();
    filters.tiers.forEach((t) => p.append('tier', t));
    filters.kbs.forEach((k) => p.append('kb', k));
    filters.levels.forEach((l) => p.append('memoryLevel', l));
    if (filters.branchId) p.set('branchId', filters.branchId);
    p.set('limit', '100');
    return p.toString();
  }, [filters]);

  const loadGraph = React.useCallback(async () => {
    const res = await api.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/memory/graph?${queryString}`);
    if (res.ok && res.data) setGraph(res.data);
  }, [queryString]);
  const loadEntries = React.useCallback(async () => {
    const res = await api.get<{ entries: MemoryEntry[] }>(`/api/memory/query?${queryString}`);
    if (res.ok && res.data) setEntries(res.data.entries);
  }, [queryString]);
  const loadBranches = React.useCallback(async () => {
    const res = await api.get<{ branches: Branch[] }>('/api/branches');
    if (res.ok && res.data) setBranches(res.data.branches ?? []);
  }, []);

  React.useEffect(() => { void loadGraph(); void loadEntries(); void loadBranches(); }, [loadGraph, loadEntries, loadBranches]);

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }
  function selectNode(id: string) {
    if (id.startsWith('entry:')) {
      const entryId = id.slice('entry:'.length);
      const node = graph.nodes.find((n) => n.id === id);
      setSelected({ id: entryId, kb: (node?.kb ?? 'decision') as KbKind });
    } else {
      setSelected(null);
    }
  }

  async function pinNode(n: GraphNode) {
    if (!n.id.startsWith('entry:')) return;
    const res = await api.post('/api/memory/library', { entryId: n.id.slice('entry:'.length), entryKb: n.kb ?? 'decision' });
    if (res.ok) setLibRefresh((k) => k + 1);
  }

  const hasFilters = filters.tiers.length > 0 || filters.kbs.length > 0 || filters.levels.length > 0 || !!filters.branchId;
  const entryCount = graph.nodes.filter((n) => n.type === 'entry').length;
  const EXPANDED_LEFT = 180;
  const EXPANDED_RIGHT = 300;

  // Matrix aggregation (4 tiers × 4 KBs)
  const matrix = React.useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const t of TIERS) m[t] = { chat: 0, code: 0, decision: 0, lesson: 0 };
    for (const e of entries) {
      const row = m[e.tier] as Record<string, number>;
      row[e.kb] = (row[e.kb] ?? 0) + 1;
    }
    return m;
  }, [entries]);
  const matrixMax = React.useMemo(() => {
    let mx = 1;
    for (const t of TIERS) for (const k of KBS) mx = Math.max(mx, matrix[t]?.[k] ?? 0);
    return mx;
  }, [matrix]);

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <SectionTitle sub="Browse, trace, and link your knowledge">Memory Explorer</SectionTitle>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {(['graph', 'timeline', 'files', 'matrix'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-[11px] font-semibold transition-all ${
                  view === v
                    ? 'bg-[var(--rust)] text-[var(--paper)] shadow-sm'
                    : 'text-[var(--dim)] hover:bg-[var(--paper2)] hover:text-[var(--ink)]'
                }`}
              >
                <span className="text-[13px]">{VIEW_META[v].icon}</span>
                {VIEW_META[v].label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { void loadGraph(); void loadEntries(); void loadBranches(); }}>
            {'↺'} refresh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--paper2)] px-3 py-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--faint)]">Filter</span>
        <div className="flex items-center gap-1">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setFilters((f) => ({ ...f, tiers: toggle(f.tiers, t) }))}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                filters.tiers.includes(t) ? 'bg-[var(--rust)] text-[var(--paper)]' : 'bg-[var(--paper)] text-[var(--dim)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}>{t}</button>
          ))}
        </div>
        <span className="h-3 w-px bg-[var(--line2)]" />
        <div className="flex items-center gap-1">
          {KBS.map((k) => (
            <button key={k} onClick={() => setFilters((f) => ({ ...f, kbs: toggle(f.kbs, k) }))}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                filters.kbs.includes(k) ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--paper)] text-[var(--dim)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}>{k}</button>
          ))}
        </div>
        <span className="h-3 w-px bg-[var(--line2)]" />
        <div className="flex items-center gap-1">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setFilters((f) => ({ ...f, levels: toggle(f.levels, l) }))}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                filters.levels.includes(l) ? 'bg-[var(--plum)] text-[var(--paper)]' : 'bg-[var(--paper)] text-[var(--dim)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}>{l}</button>
          ))}
        </div>
        <span className="h-3 w-px bg-[var(--line2)]" />
        <select
          value={filters.branchId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value || null }))}
          className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono text-[10px] text-[var(--ink)]"
        >
          <option value="">all branches</option>
          {branches.map((b) => (
            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="font-mono text-[10px] text-[var(--rust)] hover:underline">clear ✕</button>
        )}
      </div>

      {/* Mobile: stacked layout */}
      <div className="mt-4 md:hidden space-y-4">
        <LibraryRail refreshKey={libRefresh} onSelectEntry={(id, kb) => setSelected({ id, kb })} />
        <Card className="min-h-[350px] overflow-hidden p-0">
          {renderCenter()}
        </Card>
        {selected && (
          <EntryDetail entryId={selected.id} kb={selected.kb} branches={branches} onChanged={() => { void loadGraph(); void loadEntries(); void loadBranches(); setLibRefresh((k) => k + 1); }} />
        )}
      </div>

      {/* Desktop: flex layout */}
      <div className="mt-4 hidden md:flex gap-4">
        {/* Left rail */}
        <div className="relative shrink-0 transition-all duration-200" style={{ width: leftOpen ? EXPANDED_LEFT : 44 }}>
          <div className="overflow-hidden transition-all duration-200" style={{ width: leftOpen ? EXPANDED_LEFT : 0, opacity: leftOpen ? 1 : 0 }}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--faint)]">Library</span>
              <Badge tone="slate">{graph.nodes.filter((n) => n.type === 'entry').length}</Badge>
            </div>
            <LibraryRail refreshKey={libRefresh} onSelectEntry={(id, kb) => setSelected({ id, kb })} />
          </div>
          <div className="absolute top-0 z-10 transition-all duration-200" style={{ right: -12, opacity: leftOpen ? 1 : 0, pointerEvents: leftOpen ? 'auto' : 'none', transform: leftOpen ? 'scale(1)' : 'scale(0.85)' }}>
            <CollapseToggle collapsed={false} onToggle={() => setLeftOpen(false)} side="left" label="Collapse library" />
          </div>
          <div className="absolute left-1 top-0 z-10 flex items-center gap-2 transition-all duration-200" style={{ opacity: leftOpen ? 0 : 1, pointerEvents: leftOpen ? 'none' : 'auto', transform: leftOpen ? 'translateX(-8px) scale(0.85)' : 'translateX(0) scale(1)' }}>
            <span className="h-px w-3 bg-[var(--line)]" />
            <CollapseToggle collapsed={true} onToggle={() => setLeftOpen(true)} side="left" label="Show library" />
            <span className="h-px w-3 bg-[var(--line)]" />
          </div>
        </div>

        {/* Center */}
        <div className="min-w-0 flex-1">
          <Card className="min-h-[500px] overflow-hidden p-0 lg:min-h-[680px]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--faint)]">
                <span className="font-bold text-[var(--dim)]">{entryCount}</span>
                entries in {graph.nodes.filter((n) => n.type === 'kb').length} KBs
              </div>
              <div className="flex items-center gap-1">
                {view === 'graph' && graph.nodes.length > 0 && <Badge tone="teal">{graph.edges.length} edges</Badge>}
                {(view === 'timeline' || view === 'files') && <Badge tone="amber">{entries.length} recent</Badge>}
                {view === 'matrix' && <Badge tone="plum">{entries.length} cells</Badge>}
              </div>
            </div>
            {renderCenter()}
          </Card>
        </div>

        {/* Right rail */}
        <div className="relative shrink-0 transition-all duration-200" style={{ width: rightOpen ? EXPANDED_RIGHT : 44 }}>
          <div className="overflow-hidden transition-all duration-200" style={{ width: rightOpen ? EXPANDED_RIGHT : 0, opacity: rightOpen ? 1 : 0 }}>
            <EntryDetail entryId={selected?.id ?? null} kb={selected?.kb ?? 'decision'} branches={branches} onChanged={() => { void loadGraph(); void loadEntries(); void loadBranches(); setLibRefresh((k) => k + 1); }} />
          </div>
          <div className="absolute top-0 z-10 transition-all duration-200" style={{ left: -12, opacity: rightOpen ? 1 : 0, pointerEvents: rightOpen ? 'auto' : 'none', transform: rightOpen ? 'scale(1)' : 'scale(0.85)' }}>
            <CollapseToggle collapsed={false} onToggle={() => setRightOpen(false)} side="right" label="Collapse detail" />
          </div>
          <div className="absolute left-1 top-0 z-10 flex items-center gap-2 transition-all duration-200" style={{ opacity: rightOpen ? 0 : 1, pointerEvents: rightOpen ? 'none' : 'auto', transform: rightOpen ? 'translateX(-8px) scale(0.85)' : 'translateX(0) scale(1)' }}>
            <span className="h-px w-3 bg-[var(--line)]" />
            <CollapseToggle collapsed={true} onToggle={() => setRightOpen(true)} side="right" label="Show detail" />
            <span className="h-px w-3 bg-[var(--line)]" />
          </div>
        </div>
      </div>
    </div>
  );

  function renderCenter() {
    if (view === 'matrix') {
      return (
        <div className="h-[500px] overflow-auto scroll-thin p-4 lg:h-[680px]">
          <div className="space-y-1">
            <div className="grid grid-cols-[48px_repeat(4,1fr)] gap-1 font-mono text-[9px] text-[var(--faint)]">
              <div />
              {KBS.map((k) => <div key={k} className="text-center uppercase">{k}</div>)}
            </div>
            {TIERS.map((t) => (
              <div key={t} className="grid grid-cols-[48px_repeat(4,1fr)] gap-1">
                <div className="flex items-center font-mono text-[10px] font-bold text-[var(--dim)]">{t}</div>
                {KBS.map((k) => {
                  const v = matrix[t]?.[k] ?? 0;
                  const intensity = v === 0 ? 0 : 0.25 + 0.75 * (v / matrixMax);
                  return (
                    <button key={k} onClick={() => setFilters({ tiers: [t], kbs: [k], levels: [], branchId: null })}
                      title={`${t} · ${k}: ${v} entries`}
                      className="flex h-14 items-center justify-center rounded-[7px] border border-[var(--line)] font-mono text-[13px] font-bold transition-all hover:border-[var(--rust)]"
                      style={{ background: `color-mix(in srgb, var(${KB_TONE[k] === 'amber' ? '--amber' : KB_TONE[k] === 'teal' ? '--teal' : KB_TONE[k] === 'plum' ? '--plum' : '--slate'}) ${Math.round(intensity * 100)}%, var(--paper))`, color: intensity > 0.5 ? 'var(--paper)' : 'var(--ink)' }}>
                      {v || ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[9.5px] text-[var(--faint)]">Click a cell to filter the graph/timeline to that tier × KB slice.</p>
        </div>
      );
    }
    if (view === 'graph') {
      return graph.nodes.length === 0
        ? <div className="grid h-[500px] place-items-center font-mono text-[11px] text-[var(--faint)]">loading graph…</div>
        : <div className="h-[500px] lg:h-[680px]"><MemoryGraph nodes={graph.nodes} edges={graph.edges} selectedId={selected ? `entry:${selected.id}` : null} onSelect={selectNode} onPin={pinNode} /></div>;
    }
    if (view === 'timeline') {
      return (
        <div className="h-[500px] space-y-1 overflow-y-auto scroll-thin p-2 lg:h-[680px]">
          {entries.map((e) => (
            <button key={`${e.kb}:${e.id}`} onClick={() => setSelected({ id: e.id, kb: e.kb })}
              className="flex w-full items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5 text-left hover:border-[var(--rust)] transition-all hover:shadow-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${e.kb === 'chat' ? 'bg-[var(--amber)]' : e.kb === 'code' ? 'bg-[var(--teal)]' : e.kb === 'decision' ? 'bg-[var(--plum)]' : 'bg-[var(--slate)]'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12px] font-semibold text-[var(--ink)]">{e.content}</div>
                <div className="font-mono text-[9px] text-[var(--faint)]">{e.kb} · {e.tier} · {e.memory_level}</div>
              </div>
              <span className="shrink-0 font-mono text-[9px] text-[var(--faint)]">{new Date(e.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      );
    }
    // files
    return (
      <div className="h-[500px] space-y-1 overflow-y-auto scroll-thin p-2 lg:h-[680px]">
        {entries.map((e) => (
          <button key={`${e.kb}:${e.id}`} onClick={() => setSelected({ id: e.id, kb: e.kb })}
            className="flex w-full items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left hover:border-[var(--rust)] transition-all">
            <span className="font-mono text-[14px] text-[var(--faint)]">□</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px] font-semibold text-[var(--ink)]">{e.content}</div>
              <div className="font-mono text-[9px] text-[var(--faint)]">{e.memory_level}/{e.branch_id?.slice(0, 8)}/{e.kb}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
}
