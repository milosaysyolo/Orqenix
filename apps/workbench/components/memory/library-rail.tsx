// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// LIBRARY RAIL — pinned entries sidebar. Unpin uses an optimistic update: the
// item is removed locally first, the DELETE fires, and on failure we revert +
// show an error toast (Response pillar). Undo restores the pin.
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import type { LibraryItem, KbKind } from '@/lib/demo-store';

const KB_COLOR: Record<KbKind, string> = { chat: 'var(--amber)', code: 'var(--teal)', decision: 'var(--plum)', lesson: 'var(--slate)' };

export function LibraryRail({
  refreshKey, onSelectEntry,
}: {
  refreshKey: number;
  onSelectEntry: (id: string, kb: KbKind) => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<LibraryItem[]>([]);

  const load = React.useCallback(async () => {
    const res = await api.get<{ items: LibraryItem[] }>('/api/memory/library');
    if (res.ok && res.data) setItems(res.data.items);
  }, []);

  React.useEffect(() => { void load(); }, [load, refreshKey]);

  async function unpin(item: LibraryItem) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.entryId !== item.entryId)); // optimistic
    toast({ tone: 'info', title: 'Unpinned', message: item.content.slice(0, 40), duration: 1500 });
    const res = await api.del<{ ok: boolean }>('/api/memory/library', { entryId: item.entryId });
    if (!res.ok) {
      setItems(prev); // revert
      toast({ tone: 'error', title: 'Unpin failed', message: 'reverted' });
      return;
    }
    toast({ tone: 'success', title: 'Removed from library', undo: async () => {
      await api.post('/api/memory/library', { entryId: item.entryId, entryKb: item.kb });
      void load();
    } });
  }

  return (
    <Panel title="Library" action={<Badge tone="rust">{items.length}</Badge>}>
      {items.length === 0 ? (
        <div className="py-6 text-center font-mono text-[10px] text-[var(--faint)]">no pinned entries{'\n'}double-click a node to pin</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.entryId} className="group flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KB_COLOR[i.kb] }} />
              <button onClick={() => onSelectEntry(i.entryId, i.kb)} className="min-w-0 flex-1 truncate text-left font-mono text-[10.5px] text-[var(--ink)] hover:text-[var(--rust)]">{i.content}</button>
              <button onClick={() => unpin(i)} className="shrink-0 font-mono text-[11px] text-[var(--faint)] opacity-0 hover:text-[var(--rust)] group-hover:opacity-100" title="Unpin">{'\u00D7'}</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
