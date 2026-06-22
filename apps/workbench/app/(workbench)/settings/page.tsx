'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Setting { key: string; default: unknown; value: unknown; overridden: boolean; }
interface Group { moduleId: string; phase: number; crVersion: string; hotReloadable: boolean; hierarchyOverride: string; settings: Setting[]; }

export default function SettingsPage() {
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [active, setActive] = React.useState(0);
  const [edits, setEdits] = React.useState<Record<string, unknown>>({});
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ groups: Group[] }>('/api/settings');
    if (res.ok) setGroups(res.data!.groups);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const g = groups[active];

  async function save(moduleId: string, key: string) {
    const ek = `${moduleId}::${key}`;
    const value = edits[ek];
    const res = await api.post('/api/settings', { action: 'update', moduleId, key, value });
    setNote(res.ok ? `saved ${key}` : (res.error ?? 'save failed'));
    if (res.ok) await load();
  }
  async function reset(moduleId: string, key: string) {
    const res = await api.post('/api/settings', { action: 'reset', moduleId, key });
    if (res.ok) { setNote(`reset ${key}`); await load(); }
  }

  function editor(s: Setting, moduleId: string) {
    const ek = `${moduleId}::${s.key}`;
    const cur = ek in edits ? edits[ek] : s.value;
    if (typeof s.default === 'boolean') {
      return (
        <button onClick={() => setEdits((e) => ({ ...e, [ek]: !cur }))}
          className="relative h-4 w-7 rounded-full" style={{ background: cur ? 'var(--rust)' : 'var(--line2)' }}>
          <span className="absolute top-0.5 h-3 w-3 rounded-full bg-white" style={{ left: cur ? 14 : 2 }} />
        </button>
      );
    }
    return (
      <input value={String(cur)} onChange={(e) => setEdits((ed) => ({ ...ed, [ek]: typeof s.default === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-40 rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--rust)]" />
    );
  }

  return (
    <div className="mx-auto max-w-[1300px] px-6 py-6">
      <SectionTitle sub="Configure every subsystem · hierarchy-aware">Settings</SectionTitle>
      {note && <div className="mt-1 font-mono text-[10px] text-[var(--dim)]">{note}</div>}

      <div className="mt-4 grid grid-cols-[210px_1fr] gap-4">
        <Card className="p-2">
          {groups.map((grp, i) => (
            <button key={grp.moduleId} onClick={() => setActive(i)}
              className={'flex w-full items-center justify-between rounded-[7px] px-3 py-1.5 text-left font-mono text-[11px] ' +
                (i === active ? 'bg-[color-mix(in_oklab,var(--rust)8%,transparent)] font-bold text-[var(--rust)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}>
              <span>{grp.moduleId.replace('@orqenix/', '')}</span>
              <Badge tone="amber">P{grp.phase}</Badge>
            </button>
          ))}
        </Card>

        <Card className="p-4">
          {!g ? <div className="py-10 text-center font-mono text-[11px] text-[var(--faint)]">Loading…</div> : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="font-serif text-[18px] font-semibold text-[var(--ink)]">{g.moduleId.replace('@orqenix/', '')}</span>
                <Badge tone="amber">Phase {g.phase} · {g.crVersion}</Badge>
                {g.hotReloadable && <Badge tone="olive">hot-reloadable</Badge>}
                <Badge tone="slate">override: {g.hierarchyOverride}</Badge>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {g.settings.map((s) => (
                  <div key={s.key} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-mono text-[11.5px] text-[var(--ink)]">
                        {s.key}
                        {s.overridden && <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" title="overridden" />}
                      </div>
                      <div className="font-mono text-[9.5px] text-[var(--faint)]">default: {JSON.stringify(s.default)}</div>
                    </div>
                    {editor(s, g.moduleId)}
                    <Button variant="primary" size="sm" onClick={() => save(g.moduleId, s.key)}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => reset(g.moduleId, s.key)} disabled={!s.overridden}>Reset</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
