// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

interface Setting { key: string; default: unknown; value: unknown; overridden: boolean; }
interface Group { moduleId: string; phase: number; crVersion: string; hotReloadable: boolean; hierarchyOverride: string; settings: Setting[]; }

export function SettingsModulePage({ moduleId }: { moduleId: string }) {
  const { toast } = useToast();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [edits, setEdits] = React.useState<Record<string, unknown>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const res = await api.get<{ groups: Group[] }>('/api/settings');
      if (res.ok) {
        const found = res.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    }
    void load();
  }, [moduleId]);

  function editor(s: Setting) {
    const cur = s.key in edits ? edits[s.key] : s.value;
    if (typeof s.default === 'boolean') {
      return (
        <button onClick={() => setEdits((e) => ({ ...e, [s.key]: !cur }))}
          className="relative h-4 w-7 shrink-0 rounded-full transition-colors" style={{ background: cur ? 'var(--rust)' : 'var(--line2)' }}>
          <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: cur ? 14 : 2 }} />
        </button>
      );
    }
    if (typeof s.default === 'number') {
      return (
        <input type="number" value={String(cur)} onChange={(e) => setEdits((ed) => ({ ...ed, [s.key]: e.target.value }))}
          className="w-28 shrink-0 rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--rust)]" />
      );
    }
    return (
      <input value={String(cur)} onChange={(e) => setEdits((ed) => ({ ...ed, [s.key]: e.target.value }))}
        className="w-40 shrink-0 rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--rust)]" />
    );
  }

  async function handleSave(s: Setting) {
    if (!group) return;
    const newVal = s.key in edits ? edits[s.key] : s.value;
    setBusy(s.key);
    const res = await api.post('/api/settings', { action: 'update', moduleId: group.moduleId, key: s.key, value: newVal });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Saved', message: `${s.key} updated`, tone: 'success' });
      const r2 = await api.get<{ groups: Group[] }>('/api/settings');
      if (r2.ok) {
        const found = r2.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  async function handleReset(s: Setting) {
    if (!group) return;
    setBusy(s.key);
    const res = await api.post('/api/settings', { action: 'reset', moduleId: group.moduleId, key: s.key });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Reset', message: `${s.key} returned to default`, tone: 'info' });
      const r2 = await api.get<{ groups: Group[] }>('/api/settings');
      if (r2.ok) {
        const found = r2.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  if (!group) {
    return <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">Loading&hellip;</Card>;
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-serif text-[18px] font-semibold text-[var(--ink)]">{group.moduleId.replace('@orqenix/', '')}</span>
        <Badge tone="amber">Phase {group.phase} &middot; {group.crVersion}</Badge>
        {group.hotReloadable && <Badge tone="olive">hot-reloadable</Badge>}
      </div>
      <div className="divide-y divide-[var(--line)]">
        {group.settings.map((s) => (
          <div key={s.key} className="flex items-center gap-3 py-2.5">
            <div className="flex-1">
              <div className="flex items-center gap-2 font-mono text-[11.5px] text-[var(--ink)]">
                {s.key}
                {s.overridden && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]" title="overridden" />}
              </div>
              <div className="font-mono text-[9.5px] text-[var(--faint)]">default: {JSON.stringify(s.default)}</div>
            </div>
            {editor(s)}
            <Button variant="primary" size="sm" onClick={() => handleSave(s)} disabled={busy === s.key}>
              {busy === s.key ? '\u2026' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleReset(s)} disabled={!s.overridden || busy === s.key}>
              Reset
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
