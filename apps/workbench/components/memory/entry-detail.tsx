'use client';

import * as React from 'react';
import { Panel, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface EntryData {
  id: string; kb: string; tier: string; content: string | null;
  branch_id: string | null; session_id: string | null; memory_level: string;
  hash: string; created_at: string;
  promoted_from_session_id?: string | null;
  link?: { id: string; linkable: number; state: string; to_scope: string; cross_session_active: number; cross_branch_active: number } | null;
}

export function EntryDetail({
  entryId, kb, onChanged,
}: { entryId: string | null; kb: string; onChanged: () => void }) {
  const [entry, setEntry] = React.useState<EntryData | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!entryId) { setEntry(null); return; }
    const res = await api.get<{ entry: EntryData }>(`/api/memory/${entryId}?kb=${kb}`);
    if (res.ok) setEntry(res.data!.entry);
  }, [entryId, kb]);

  React.useEffect(() => { void load(); }, [load]);

  if (!entryId) {
    return <Panel title="Entry Detail"><div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Select a memory to inspect.</div></Panel>;
  }
  if (!entry) {
    return <Panel title="Entry Detail"><div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Loading&hellip;</div></Panel>;
  }

  const linkable = entry.link?.linkable === 1;
  const linkState = entry.link?.state ?? 'none';

  async function toggleLink() {
    setBusy(true);
    const next = !linkable;
    setEntry((e) => (e ? { ...e, link: { ...(e.link ?? { id: '', state: 'created', to_scope: '', cross_session_active: 1, cross_branch_active: 1 }), linkable: next ? 1 : 0 } } : e));
    const res = await api.post('/api/memory/link', { action: 'toggle', entryId: entry!.id, entryKb: entry!.kb, linkable: next });
    setBusy(false);
    if (!res.ok) { setNote(res.error ?? 'toggle failed'); void load(); }
  }

  async function action(kind: 'promote' | 'clone' | 'export') {
    setBusy(true); setNote(null);
    const res = await api.post<{ ok: boolean; entry?: unknown }>(`/api/memory/${entry!.id}`, {
      action: kind, kb: entry!.kb, branchId: entry!.branch_id, sessionId: entry!.session_id,
    });
    setBusy(false);
    if (res.ok) {
      if (kind === 'export') {
        const blob = new Blob([JSON.stringify(res.data?.entry ?? entry, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${entry!.id}.json`; a.click();
        URL.revokeObjectURL(url);
      }
      setNote(`${kind} ok`); onChanged();
    } else setNote(res.error ?? `${kind} failed`);
  }

  async function del() {
    if (!confirm(`Delete memory ${entry!.id}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await api.del(`/api/memory/${entry!.id}?kb=${entry!.kb}`);
    setBusy(false);
    if (res.ok) { setEntry(null); onChanged(); } else setNote(res.error ?? 'delete failed');
  }

  async function severLink() {
    if (!entry!.link?.id) return;
    await api.post('/api/memory/link', { action: 'sever', linkId: entry!.link.id });
    void load(); onChanged();
  }

  return (
    <Panel
      title="Entry Detail"
      action={
        <label className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--dim)]">
          Link Memory
          <button
            onClick={toggleLink}
            disabled={busy}
            className="relative h-4 w-7 rounded-full transition-colors"
            style={{ background: linkable ? 'var(--rust)' : 'var(--line2)' }}
            aria-pressed={linkable}
          >
            <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: linkable ? 14 : 2 }} />
          </button>
        </label>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={entry.kb === 'decision' ? 'plum' : entry.kb === 'code' ? 'teal' : 'amber'}>{entry.kb}KB</Badge>
          <Badge tone="neutral">{entry.tier}</Badge>
          <Badge tone="slate">{entry.memory_level}</Badge>
        </div>

        <div className="grid grid-cols-[90px_1fr] gap-y-1 font-mono text-[10.5px]">
          <span className="text-[var(--faint)]">ID</span><span className="truncate text-[var(--ink)]">{entry.id}</span>
          <span className="text-[var(--faint)]">Branch</span><span className="text-[var(--ink)]">{entry.branch_id ?? '&mdash;'}</span>
          <span className="text-[var(--faint)]">Session</span><span className="text-[var(--ink)]">{entry.session_id ?? '&mdash;'}</span>
          <span className="text-[var(--faint)]">Hash</span><span className="truncate text-[var(--ink)]">{entry.hash}</span>
          {entry.promoted_from_session_id && (<><span className="text-[var(--faint)]">Promoted</span><span className="text-[var(--olive)]">from {entry.promoted_from_session_id}</span></>)}
        </div>

        <div className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-3 text-[12px] leading-relaxed text-[var(--ink)]">
          {entry.content ?? '(no content)'}
        </div>

        <div className="rounded-[9px] border border-[var(--line2)] bg-[color-mix(in_oklab,var(--rust)4%,var(--card))] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Cross-scope linking</span>
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: linkState === 'active' ? 'var(--olive)' : 'var(--faint)' }} />
              {linkState}
            </span>
          </div>
          {linkable ? (
            <>
              <p className="font-mono text-[10px] text-[var(--dim)]">Other scopes may pull this memory (narrowing read only).</p>
              {entry.link?.to_scope && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="teal">{entry.link.to_scope}</Badge>
                  <button onClick={severLink} className="text-[var(--faint)] hover:text-[var(--rust)]" aria-label="Sever">&times;</button>
                </div>
              )}
              <div className="mt-2 flex gap-3 font-mono text-[10px] text-[var(--dim)]">
                <span>cross-session: {entry.link?.cross_session_active ? 'on' : 'off'}</span>
                <span>cross-branch: {entry.link?.cross_branch_active ? 'on' : 'off'}</span>
              </div>
              <button className="mt-2 flex items-center gap-1 font-mono text-[10px] text-[var(--dim)] hover:text-[var(--ink)]">
                &#x1f512; cross-project: request approval
              </button>
            </>
          ) : (
            <p className="font-mono text-[10px] text-[var(--faint)]">Linking disabled. Toggle &ldquo;Link Memory&rdquo; to allow cross-scope pulls.</p>
          )}
        </div>

        {note && <div className="font-mono text-[10px] text-[var(--rust)]">{note}</div>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" size="sm" onClick={() => action('promote')} disabled={busy}>Promote</Button>
          <Button variant="outline" size="sm" onClick={() => action('clone')} disabled={busy}>Clone</Button>
          <Button variant="outline" size="sm" onClick={() => action('export')} disabled={busy}>Export</Button>
          <Button variant="danger" size="sm" onClick={del} disabled={busy}>Delete</Button>
        </div>
      </div>
    </Panel>
  );
}
