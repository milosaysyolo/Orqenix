// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// ENTRY DETAIL — right-hand panel showing a memory entry, with optimistic pin
// and link actions. Toasts confirm success and offer undo (Response pillar).
// ============================================================================

'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import type { KbKind, MemoryLevel } from '@/lib/demo-store';

interface Entry {
  id: string; kb: KbKind; tier: string; content: string; branch_id: string;
  session_id: string; memory_level: MemoryLevel; created_at: string;
  links?: Array<{ from: string; to: string }>;
  pinned?: boolean;
}

const KB_TONE: Record<KbKind, 'amber' | 'teal' | 'plum' | 'slate'> = { chat: 'amber', code: 'teal', decision: 'plum', lesson: 'slate' };

export function EntryDetail({ entryId, kb, branches, onChanged }: { entryId: string | null; kb: KbKind; branches: Array<{ branch_id: string; branch_name: string }>; onChanged: () => void }) {
  const { toast } = useToast();
  const [entry, setEntry] = React.useState<Entry | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [promoting, setPromoting] = React.useState(false);
  const [targetBranch, setTargetBranch] = React.useState<string>('');

  const load = React.useCallback(async () => {
    if (!entryId) { setEntry(null); return; }
    setLoading(true);
    const res = await api.get<Entry>(`/api/memory/${entryId}`);
    if (res.ok && res.data) setEntry(res.data);
    setLoading(false);
  }, [entryId]);

  React.useEffect(() => { void load(); }, [load]);

  const canPromote = !!entry && entry.memory_level !== 'project';
  const defaultBranch = branches.find((b) => b.branch_id === entry?.branch_id)?.branch_id ?? branches[0]?.branch_id ?? '';

  async function promote() {
    if (!entryId) return;
    const target = targetBranch || defaultBranch;
    if (!target) return;
    setPromoting(true);
    toast({ tone: 'info', title: 'Promoting to branch…', duration: 1200 });
    const res = await api.post<{ ok: boolean; newId: string }>('/api/memory/promote', { entryId, targetBranchId: target });
    setPromoting(false);
    if (res.ok) {
      onChanged();
      toast({ tone: 'success', title: 'Promoted to branch', message: res.data?.newId });
    } else {
      toast({ tone: 'error', title: 'Promote failed', message: res.error });
    }
  }

  async function pin() {
    if (!entryId) return;
    toast({ tone: 'info', title: 'Pinning…', duration: 1200 });
    const res = await api.post<{ ok: boolean }>('/api/memory/library', { entryId, entryKb: kb });
    if (res.ok) {
      setEntry((e) => (e ? { ...e, pinned: true } : e));
      onChanged();
      toast({ tone: 'success', title: 'Pinned to library', undo: async () => {
        await api.del('/api/memory/library', { entryId });
        onChanged();
      } });
    } else {
      toast({ tone: 'error', title: 'Pin failed' });
    }
  }

  if (!entryId) {
    return (
      <Panel title="Detail">
        <div className="grid h-[420px] place-items-center text-center font-mono text-[10.5px] text-[var(--faint)]">
          select a node or entry to inspect
        </div>
      </Panel>
    );
  }

  if (loading || !entry) {
    return (
      <Panel title="Detail">
        <div className="grid h-[420px] place-items-center font-mono text-[10.5px] text-[var(--faint)]">loading…</div>
      </Panel>
    );
  }

  return (
    <Panel title="Detail" action={<Badge tone={KB_TONE[entry.kb]}>{entry.kb}</Badge>}>
      <div className="space-y-3">
        <div className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
          <p className="font-serif text-[14px] leading-snug text-[var(--ink)]">{entry.content}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
          <div className="rounded-[7px] bg-[var(--paper)] px-2 py-1.5"><div className="text-[var(--faint)]">tier</div><div className="font-bold text-[var(--ink)]">{entry.tier}</div></div>
          <div className="rounded-[7px] bg-[var(--paper)] px-2 py-1.5"><div className="text-[var(--faint)]">level</div><div className="font-bold text-[var(--ink)]">{entry.memory_level}</div></div>
          <div className="rounded-[7px] bg-[var(--paper)] px-2 py-1.5"><div className="text-[var(--faint)]">branch</div><div className="truncate font-bold text-[var(--ink)]">{entry.branch_id.slice(0, 10)}</div></div>
          <div className="rounded-[7px] bg-[var(--paper)] px-2 py-1.5"><div className="text-[var(--faint)]">session</div><div className="truncate font-bold text-[var(--ink)]">{entry.session_id}</div></div>
          <div className="col-span-2 rounded-[7px] bg-[var(--paper)] px-2 py-1.5"><div className="text-[var(--faint)]">created</div><div className="font-bold text-[var(--ink)]">{new Date(entry.created_at).toLocaleString()}</div></div>
        </div>

        {(entry.links?.length ?? 0) > 0 && (
          <div>
            <div className="mb-1 font-mono text-[9.5px] font-extrabold uppercase tracking-wide text-[var(--dim)]">links</div>
            <div className="space-y-1">
              {entry.links!.map((l, i) => (
                <div key={i} className="font-mono text-[10px] text-[var(--rust)]">{l.from} {'\u2194'} {l.to}</div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <Button size="sm" variant={entry.pinned ? 'ghost' : 'primary'} disabled={entry.pinned} onClick={pin}>
              {entry.pinned ? 'pinned ✓' : 'pin to library'}
            </Button>
            <Button size="sm" variant="outline" disabled={!canPromote || promoting} onClick={promote} title={canPromote ? 'Promote to branch level' : 'Already at project level'}>
              {promoting ? 'promoting…' : '↑ promote to branch'}
            </Button>
          </div>
          {canPromote && branches.length > 0 && (
            <select
              value={targetBranch || defaultBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono text-[10px] text-[var(--ink)]"
            >
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </Panel>
  );
}
