// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import type { MemoryLevel } from '@/lib/demo-store';

interface Branch {
  branch_id: string;
  branch_name: string;
  created_at: string;
  cloned_from_branch_id: string | null;
  sessions: number;
}

interface MemEntry {
  id: string;
  kb: string;
  tier: string;
  content: string;
  branch_id: string;
  memory_level: MemoryLevel;
}

function daysAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff}d ago`;
}

const KB_TONE: Record<string, 'amber' | 'teal' | 'plum' | 'slate'> = { chat: 'amber', code: 'teal', decision: 'plum', lesson: 'slate' };

export default function BranchesPage() {
  const { toast } = useToast();
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [entries, setEntries] = React.useState<MemEntry[]>([]);
  const [parent, setParent] = React.useState('');
  const [name, setName] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [promoteFor, setPromoteFor] = React.useState<Branch | null>(null);
  const [promoteEntry, setPromoteEntry] = React.useState('');
  const [promoting, setPromoting] = React.useState(false);

  const load = React.useCallback(async () => {
    const [b, e] = await Promise.all([
      api.get<{ branches: Branch[] }>('/api/branches'),
      api.get<{ entries: MemEntry[] }>('/api/memory/query?limit=1000'),
    ]);
    if (b.ok) setBranches(b.data!.branches);
    if (e.ok) setEntries(e.data!.entries);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const mainBranch = branches.find((b) => b.branch_name === 'main');
  const activeBranch = mainBranch ?? branches[0];
  const totalSessions = branches.reduce((s, b) => s + b.sessions, 0);

  async function handleCreate() {
    if (!parent || !name.trim()) return;
    setCreating(true);
    const res = await api.post<{ ok: boolean; branchId: string; indexRowsCloned: number }>('/api/branches', {
      action: 'create',
      parentBranchId: parent,
      newBranchName: name.trim(),
    });
    setCreating(false);
    if (res.ok) {
      toast({ title: 'Branch created', message: `${res.data!.indexRowsCloned} index rows deep-copied`, tone: 'success' });
      setName('');
      await load();
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown error', tone: 'error' });
    }
  }

  async function handlePromote() {
    if (!promoteFor || !promoteEntry) return;
    setPromoting(true);
    const res = await api.post<{ ok: boolean; newId: string }>('/api/branches', {
      action: 'promote',
      entryId: promoteEntry,
      targetBranchId: promoteFor.branch_id,
    });
    setPromoting(false);
    if (res.ok) {
      toast({ title: 'Entry promoted', message: `${promoteEntry} → ${promoteFor.branch_name} (${res.data!.newId})`, tone: 'success' });
      setPromoteFor(null);
      setPromoteEntry('');
      await load();
    } else {
      toast({ title: 'Promote failed', message: res.error ?? 'unknown error', tone: 'error' });
    }
  }

  const promotedFor = (branchId: string) => entries.filter((e) => e.branch_id === branchId && e.memory_level === 'branch');
  // Entries eligible for promotion: session-level entries not already on this branch.
  const eligibleFor = (branchId: string) => entries.filter((e) => e.memory_level !== 'branch' && e.branch_id !== branchId);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="flex items-start justify-between">
        <div>
          <SectionTitle sub="Branch-isolated memory with copy-on-write deep-copy">Branches</SectionTitle>
        </div>
        <Badge tone="teal">{branches.length} branches</Badge>
      </div>

      {/* Stats mini-row */}
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <Card className="px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--faint)]">Total Branches</div>
          <div className="mt-0.5 font-mono text-[20px] font-extrabold text-[var(--ink)]">{branches.length}</div>
        </Card>
        <Card className="px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--faint)]">Active</div>
          <div className="mt-0.5 font-mono text-[20px] font-extrabold text-[var(--teal)]">{activeBranch?.branch_name ?? '—'}</div>
        </Card>
        <Card className="px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--faint)]">Total Sessions</div>
          <div className="mt-0.5 font-mono text-[20px] font-extrabold text-[var(--plum)]">{totalSessions}</div>
        </Card>
        <Card className="px-3 py-2.5 col-span-3 sm:col-span-1">
          <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--faint)]">Deep Copies</div>
          <div className="mt-0.5 font-mono text-[20px] font-extrabold text-[var(--rust)]">{branches.filter((b) => b.cloned_from_branch_id).length}</div>
        </Card>
      </div>

      {/* Create branch form */}
      <Card className="mt-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--dim)]">New Branch</span>
          <span className="font-mono text-[9px] text-[var(--faint)]">deep-copy from parent</span>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:w-52">
            <label className="block font-mono text-[9px] text-[var(--faint)] mb-1">Parent branch</label>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)] transition-colors"
            >
              <option value="">Select parent…</option>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_name} ({b.branch_id?.slice(0, 10) ?? ''}…)
                </option>
              ))}
            </select>
          </div>
          <div className="w-full flex-1">
            <label className="block font-mono text-[9px] text-[var(--faint)] mb-1">Branch name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-new-branch"
              className="w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)] transition-colors"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={!parent || !name.trim() || creating}>
            {creating ? 'Cloning…' : 'Create Branch'}
          </Button>
        </div>
      </Card>

      {/* Branch tree */}
      <div className="mt-5 space-y-2">
        {branches.length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">No branches.</Card>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--dim)]">Branch Tree</span>
              <span className="font-mono text-[9px] text-[var(--faint)]">sorted by creation date</span>
            </div>
            {branches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((b) => {
              const parentName = b.cloned_from_branch_id
                ? branches.find((p) => p.branch_id === b.cloned_from_branch_id)?.branch_name ?? 'unknown'
                : null;
              const promoted = promotedFor(b.branch_id);
              const isOpen = expanded === b.branch_id;
              return (
                <Card key={b.branch_id} className="px-4 py-3 hover:border-[var(--rust)]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Depth indicator */}
                    <div className="flex items-center">
                      {parentName ? (
                        <>
                          <span className="font-mono text-[11px] text-[var(--faint)]">└</span>
                          <span className="w-3 h-px bg-[var(--line)]" />
                        </>
                      ) : (
                        <span className="w-5" />
                      )}
                    </div>
                    <span className="font-mono text-[16px] text-[var(--plum)]">⎇</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[12px] font-bold text-[var(--ink)]">{b.branch_name}</span>
                        {b.branch_name === 'main' && <Badge tone="teal">main</Badge>}
                        {parentName && <Badge tone="neutral">forked from {parentName}</Badge>}
                        {promoted.length > 0 && <Badge tone="plum">↑{promoted.length} promoted</Badge>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-[var(--faint)]">
                        <span>{b.branch_id?.slice(0, 16) ?? ''}…</span>
                        <span>·</span>
                        <span>{daysAgo(b.created_at)}</span>
                        <span>·</span>
                        <span>{b.sessions} session{b.sessions !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5">
                      <div className="h-5 w-16 rounded-sm bg-[var(--paper2)] overflow-hidden">
                        <div
                          className="h-full rounded-sm bg-[var(--rust)] transition-all"
                          style={{ width: `${Math.min(100, (b.sessions / Math.max(...branches.map((x) => x.sessions))) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-[var(--dim)]">{b.sessions}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPromoteFor(b)} title="Promote an entry to this branch">
                      ↑ Promote Entry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : b.branch_id)}>
                      {isOpen ? '▾' : '▸'} {promoted.length ? `${promoted.length} entries` : ''}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 border-t border-[var(--line)] pt-3">
                      {promoted.length === 0 ? (
                        <div className="font-mono text-[10px] text-[var(--faint)]">No promoted entries yet. Use “↑ Promote Entry” to lift a session/project entry to this branch.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {promoted.map((e) => (
                            <div key={e.id} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
                              <Badge tone={KB_TONE[e.kb] ?? 'slate'}>{e.kb}</Badge>
                              <span className="font-mono text-[9px] text-[var(--faint)]">{e.tier}</span>
                              <span className="flex-1 truncate font-mono text-[11px] text-[var(--ink)]">{e.content}</span>
                              <span className="font-mono text-[9px] text-[var(--plum)]">{e.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Promote Entry modal */}
      {promoteFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPromoteFor(null)}>
          <div className="w-full max-w-[520px] rounded-[12px] border border-[var(--line2)] bg-[var(--card)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-serif text-[16px] font-bold text-[var(--ink)]">Promote Entry to Branch</div>
                <div className="font-mono text-[10px] text-[var(--faint)]">target: {promoteFor.branch_name}</div>
              </div>
              <button onClick={() => setPromoteFor(null)} className="font-mono text-[14px] text-[var(--dim)] hover:text-[var(--rust)]">✕</button>
            </div>
            <label className="block font-mono text-[9px] text-[var(--faint)] mb-1">Entry (session / project level)</label>
            <select
              value={promoteEntry}
              onChange={(e) => setPromoteEntry(e.target.value)}
              className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
            >
              <option value="">Select entry…</option>
              {eligibleFor(promoteFor.branch_id).map((e) => (
                <option key={e.id} value={e.id}>{e.kb} · {e.memory_level} · {e.content.slice(0, 48)}</option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPromoteFor(null)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={handlePromote} disabled={!promoteEntry || promoting}>
                {promoting ? 'Promoting…' : 'Promote'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
