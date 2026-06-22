'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface LibItem { id: string; entry_id: string; entry_kb: string; }

export function LibraryRail({
  refreshKey, onSelectEntry,
}: { refreshKey: number; onSelectEntry: (entryId: string, kb: string) => void }) {
  const [items, setItems] = React.useState<LibItem[]>([]);

  const load = React.useCallback(async () => {
    const res = await api.get<{ items: LibItem[] }>('/api/memory/library');
    if (res.ok) setItems(res.data?.items ?? []);
  }, []);

  React.useEffect(() => { void load(); }, [load, refreshKey]);

  async function unpin(entryId: string) {
    setItems((prev) => prev.filter((i) => i.entry_id !== entryId));
    await api.del(`/api/memory/library?entryId=${encodeURIComponent(entryId)}`);
  }

  return (
    <Panel
      title="Library"
      action={<Button size="sm" variant="primary">Create Link</Button>}
      className="h-full"
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-[9px] border border-dashed border-[var(--line2)] px-3 py-8 text-center font-mono text-[10.5px] text-[var(--faint)]">
            drag memories here<br />to pin &amp; link
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="group flex items-center gap-2 rounded-[9px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-2 transition-colors hover:border-[var(--rust)]"
            >
              <button className="flex-1 truncate text-left" onClick={() => onSelectEntry(it.entry_id, it.entry_kb)}>
                <Badge tone={it.entry_kb === 'decision' ? 'plum' : it.entry_kb === 'code' ? 'teal' : 'amber'}>
                  {it.entry_kb}
                </Badge>
                <span className="ml-2 font-mono text-[10.5px] text-[var(--ink)]">{it.entry_id.slice(0, 14)}&hellip;</span>
              </button>
              <button
                onClick={() => unpin(it.entry_id)}
                className="opacity-0 transition-opacity group-hover:opacity-100 text-[var(--faint)] hover:text-[var(--rust)]"
                aria-label="Unpin"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
