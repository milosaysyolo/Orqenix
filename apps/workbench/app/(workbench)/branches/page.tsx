'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Branch { branch_id: string; branch_name: string; created_at: string; cloned_from_branch_id: string | null; sessions: number; }

export default function BranchesPage() {
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [name, setName] = React.useState('feature/');
  const [parent, setParent] = React.useState('blake3:main0000000000aabb');
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ branches: Branch[] }>('/api/branches');
    if (res.ok) setBranches(res.data!.branches);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function create() {
    setNote(null);
    const res = await api.post<{ ok: boolean; indexRowsCloned: number }>('/api/branches', { action: 'create', parentBranchId: parent, newBranchName: name });
    if (res.ok) { setNote(`deep-copied ${res.data?.indexRowsCloned} index rows`); setName('feature/'); await load(); }
    else setNote(res.error ?? 'create failed');
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <SectionTitle sub="Branch-isolated memory with copy-on-write deep-copy">Branches</SectionTitle>

      <Card className="mt-4 flex flex-wrap items-center gap-2 p-3">
        <select value={parent} onChange={(e) => setParent(e.target.value)}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px]">
          <option value="blake3:main0000000000aabb">parent: main</option>
          {branches.map((b) => <option key={b.branch_id} value={b.branch_id}>parent: {b.branch_name}</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="feature/name"
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px] outline-none focus:border-[var(--rust)]" />
        <Button variant="primary" size="sm" onClick={create} disabled={name === 'feature/'}>+ New Branch (deep-copy)</Button>
        {note && <span className="font-mono text-[10px] text-[var(--dim)]">{note}</span>}
      </Card>

      <div className="mt-4 space-y-2">
        {branches.length === 0 ? (
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">No branches yet (main is implicit).</Card>
        ) : branches.map((b) => (
          <Card key={b.branch_id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-[var(--plum)]">⎇</span>
            <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{b.branch_name}</span>
            <span className="font-mono text-[10px] text-[var(--faint)]">{b.branch_id.slice(0, 16)}…</span>
            {b.cloned_from_branch_id && <Badge tone="slate">cloned</Badge>}
            <span className="ml-auto font-mono text-[10px] text-[var(--dim)]">{b.sessions} sessions</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
