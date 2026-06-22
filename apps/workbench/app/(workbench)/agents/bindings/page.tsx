'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Binding { platform: string; state: string; config_path?: string; }

export default function BindingsPage() {
  const [bindings, setBindings] = React.useState<Binding[]>([]);
  const [test, setTest] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const res = await api.get<{ bindings: Binding[] }>('/api/bindings');
    if (res.ok) setBindings(res.data!.bindings);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function act(action: 'install' | 'uninstall' | 'test', platform: string) {
    const res = await api.post<{ ok: boolean; capabilities?: { tools: number; resources: number; prompts: number } }>('/api/bindings', { action, platform });
    if (action === 'test') {
      if (res.ok) setTest((t) => ({ ...t, [platform]: `\u2713 ${res.data?.capabilities?.tools}/${res.data?.capabilities?.resources}/${res.data?.capabilities?.prompts}` }));
      else setTest((t) => ({ ...t, [platform]: 'failed' }));
    } else await load();
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <SectionTitle sub="Bridge Orqenix into your agent platforms (Apache-2.0, no lock-in)">Bindings</SectionTitle>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {bindings.map((b) => (
          <Card key={b.platform} className="p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{b.platform}</span>
              <Badge tone={b.state === 'active' ? 'olive' : 'neutral'}>{b.state.replace('_', ' ')}</Badge>
              {test[b.platform] && <span className="font-mono text-[10px] text-[var(--dim)]">{test[b.platform]}</span>}
            </div>
            {b.config_path && <div className="mt-1 font-mono text-[10px] text-[var(--faint)]">{b.config_path}</div>}
            <div className="mt-3 flex gap-2">
              {b.state === 'active'
                ? <Button variant="danger" size="sm" onClick={() => act('uninstall', b.platform)}>Uninstall</Button>
                : <Button variant="primary" size="sm" onClick={() => act('install', b.platform)}>Install</Button>}
              <Button variant="outline" size="sm" onClick={() => act('test', b.platform)}>Test</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
