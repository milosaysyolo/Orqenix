// SPDX-License-Identifier: Apache-2.0
// W3.A , Plugins page — installed plugins management grouped by kind

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface InstalledPlugin { package_name: string; version: string; kind: string; state: string; }

export default function PluginsPage() {
  const [plugins, setPlugins] = React.useState<InstalledPlugin[]>([]);

  const load = React.useCallback(async () => {
    const res = await api.get<{ plugins: InstalledPlugin[] }>('/api/plugins');
    if (res.ok) setPlugins(res.data!.plugins);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function toggle(p: InstalledPlugin) {
    const action = p.state === 'active' ? 'deactivate' : 'activate';
    await api.post('/api/plugins', { action, name: p.package_name });
    await load();
  }

  const byKind = React.useMemo(() => {
    const m = new Map<string, InstalledPlugin[]>();
    for (const p of plugins) { const a = m.get(p.kind) ?? []; a.push(p); m.set(p.kind, a); }
    return m;
  }, [plugins]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <SectionTitle sub="Manage installed plugins across 14 kinds">Plugins</SectionTitle>
      {plugins.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          No plugins installed. Visit the Marketplace to install.
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {[...byKind.entries()].map(([kind, list]) => (
            <div key={kind}>
              <div className="mb-2 font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--faint)]">{kind} ({list.length})</div>
              <div className="space-y-2">
                {list.map((p) => (
                  <Card key={p.package_name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{p.package_name}</span>
                    <Badge tone="neutral">v{p.version}</Badge>
                    <Badge tone={p.state === 'active' ? 'olive' : 'neutral'}>{p.state}</Badge>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggle(p)}>{p.state === 'active' ? 'Deactivate' : 'Activate'}</Button>
                      <Button variant="ghost" size="sm">Configure</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
