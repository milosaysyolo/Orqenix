'use client';

import * as React from 'react';
import { SectionTitle, Button, Card } from '@/components/ui';
import { GraphView } from '@/components/memory/graph-view';
import { LibraryRail } from '@/components/memory/library-rail';
import { EntryDetail } from '@/components/memory/entry-detail';
import { api } from '@/lib/api';

type View = 'graph' | 'timeline' | 'files' | 'library';

interface GNode { id: string; label: string; type: string; kb?: string; tier?: string; count?: number; }
interface GEdge { from: string; to: string; type: string; label?: string; }
interface Entry { id: string; kb: string; tier: string; content: string; branch_id: string; session_id: string; memory_level: string; created_at: string; }

export default function MemoryExplorerPage() {
  const [view, setView] = React.useState<View>('graph');
  const [graph, setGraph] = React.useState<{ nodes: GNode[]; edges: GEdge[] }>({ nodes: [], edges: [] });
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [selected, setSelected] = React.useState<{ id: string; kb: string } | null>(null);
  const [libRefresh, setLibRefresh] = React.useState(0);

  const loadGraph = React.useCallback(async () => {
    const res = await api.get<{ nodes: GNode[]; edges: GEdge[] }>('/api/memory/graph');
    if (res.ok) setGraph(res.data!);
  }, []);
  const loadEntries = React.useCallback(async () => {
    const res = await api.get<{ entries: Entry[] }>('/api/memory/query?limit=100');
    if (res.ok) setEntries(res.data!.entries);
  }, []);

  React.useEffect(() => { void loadGraph(); void loadEntries(); }, [loadGraph, loadEntries]);

  function selectNode(id: string) {
    if (id.startsWith('entry:')) {
      const entryId = id.slice('entry:'.length);
      const node = graph.nodes.find((n) => n.id === id);
      setSelected({ id: entryId, kb: node?.kb ?? 'decision' });
    }
  }

  async function pinNode(n: GNode) {
    if (!n.id.startsWith('entry:')) return;
    await api.post('/api/memory/library', { entryId: n.id.slice('entry:'.length), entryKb: n.kb ?? 'decision' });
    setLibRefresh((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionTitle sub="Browse, trace, and link your knowledge">Memory Explorer</SectionTitle>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="inline-flex rounded-[9px] border border-[var(--line2)] p-0.5">
          {(['graph', 'timeline', 'files', 'library'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={'rounded-[7px] px-3 py-1 font-mono text-[11px] font-semibold capitalize transition-colors ' +
                (view === v ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}
            >
              {v}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => { void loadGraph(); void loadEntries(); }}>&#x21BA; refresh</Button>
      </div>

      <div className="mt-4 grid grid-cols-[210px_1fr_340px] gap-4">
        <LibraryRail refreshKey={libRefresh} onSelectEntry={(id, kb) => setSelected({ id, kb })} />

        <Card className="min-h-[560px] p-3">
          {view === 'graph' && (
            <GraphView nodes={graph.nodes} edges={graph.edges} selectedId={selected ? `entry:${selected.id}` : null} onSelect={selectNode} onPin={pinNode} />
          )}
          {view === 'timeline' && (
            <div className="space-y-1.5">
              {entries.map((e) => (
                <button key={`${e.kb}:${e.id}`} onClick={() => setSelected({ id: e.id, kb: e.kb })}
                  className="flex w-full items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left transition-colors hover:border-[var(--rust)]">
                  <span className="font-mono text-[10px] text-[var(--faint)]">{new Date(e.created_at).toLocaleTimeString()}</span>
                  <span className="font-mono text-[10px] text-[var(--teal)]">{e.kb} &middot; {e.tier}</span>
                  <span className="flex-1 truncate font-mono text-[11px] text-[var(--ink)]">{e.content}</span>
                </button>
              ))}
            </div>
          )}
          {(view === 'files' || view === 'library') && (
            <div className="space-y-1.5">
              {entries.map((e) => (
                <button key={`${e.kb}:${e.id}`} onClick={() => setSelected({ id: e.id, kb: e.kb })}
                  className="flex w-full items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-left transition-colors hover:border-[var(--rust)]">
                  <span className="font-mono text-[10px] text-[var(--slate)]">{e.memory_level}/{e.branch_id?.slice(0, 8)}/{e.kb}</span>
                  <span className="flex-1 truncate font-mono text-[11px] text-[var(--ink)]">{e.content}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <EntryDetail entryId={selected?.id ?? null} kb={selected?.kb ?? 'decision'} onChanged={() => { void loadGraph(); void loadEntries(); }} />
      </div>
    </div>
  );
}
