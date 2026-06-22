'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface McpData {
  status: string; endpoint: string;
  transports: Array<{ kind: string; state: string; port?: number }>;
  tools: Array<{ name: string; description: string; permission: string }>;
  resources: Array<{ uri: string; description: string }>;
  prompts: Array<{ name: string; description: string }>;
  tokens: Array<{ id: string; client: string; scopes_json: string; expires_at: string }>;
}

export default function McpPage() {
  const [data, setData] = React.useState<McpData | null>(null);
  const [tab, setTab] = React.useState<'tools' | 'resources' | 'prompts'>('tools');

  const load = React.useCallback(async () => {
    const res = await api.get<McpData>('/api/mcp');
    if (res.ok) setData(res.data!);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function issue() {
    await api.post('/api/mcp', { action: 'issue', client: 'workbench-client', scopes: ['memory.read', 'memory.write'] });
    await load();
  }
  async function revoke(id: string) { await api.post('/api/mcp', { action: 'revoke', tokenId: id }); await load(); }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <SectionTitle sub="The substrate your agents reach into">MCP Server</SectionTitle>

      <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
        <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[var(--olive)]" /><span className="font-mono text-[12px] font-bold text-[var(--ink)]">orqenix-mcp</span></span>
        <Badge tone="olive">{data?.status ?? '\u2026'}</Badge>
        <span className="font-mono text-[11px] text-[var(--dim)]">{data?.endpoint}</span>
        <div className="ml-auto flex gap-2">
          <Badge tone="rust">{data?.tools.length ?? 0} Tools</Badge>
          <Badge tone="teal">{data?.resources.length ?? 0} Resources</Badge>
          <Badge tone="plum">{data?.prompts.length ?? 0} Prompts</Badge>
        </div>
      </Card>

      <div className="mt-3 flex gap-2">
        {(data?.transports ?? []).map((t) => (
          <Badge key={t.kind} tone={t.state === 'connected' ? 'olive' : 'neutral'}>{t.kind}{t.port ? `:${t.port}` : ''} &middot; {t.state}</Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_320px] gap-4">
        <div>
          <div className="mb-2 flex gap-2">
            {(['tools', 'resources', 'prompts'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={'rounded-[9px] px-3 py-1 font-mono text-[11px] font-semibold capitalize ' +
                  (tab === t ? 'bg-[var(--card)] border border-[var(--line2)] text-[var(--ink)]' : 'text-[var(--dim)]')}>{t}</button>
            ))}
          </div>
          <Card className="divide-y divide-[var(--line)]">
            {tab === 'tools' && (data?.tools ?? []).map((t) => (
              <div key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className="font-mono text-[11.5px] font-bold text-[var(--ink)]">{t.name}</span>
                <span className="flex-1 truncate text-[11px] text-[var(--dim)]">{t.description}</span>
                <Badge tone="amber">{t.permission}</Badge>
              </div>
            ))}
            {tab === 'resources' && (data?.resources ?? []).map((r) => (
              <div key={r.uri} className="px-4 py-2.5">
                <div className="font-mono text-[11px] font-bold text-[var(--teal)]">{r.uri}</div>
                <div className="text-[10.5px] text-[var(--dim)]">{r.description}</div>
              </div>
            ))}
            {tab === 'prompts' && (data?.prompts ?? []).map((p) => (
              <div key={p.name} className="px-4 py-2.5">
                <div className="font-mono text-[11px] font-bold text-[var(--plum)]">{p.name}</div>
                <div className="text-[10.5px] text-[var(--dim)]">{p.description}</div>
              </div>
            ))}
          </Card>
        </div>

        <Card className="h-fit p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Capability Tokens</span>
            <Button variant="primary" size="sm" onClick={issue}>Issue</Button>
          </div>
          <div className="space-y-2">
            {(data?.tokens ?? []).length === 0 ? (
              <div className="py-4 text-center font-mono text-[10px] text-[var(--faint)]">No active tokens.</div>
            ) : (data?.tokens ?? []).map((tok) => (
              <div key={tok.id} className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--olive)]" />
                  <span className="font-mono text-[11px] font-bold text-[var(--ink)]">{tok.client}</span>
                  <button onClick={() => revoke(tok.id)} className="ml-auto font-mono text-[10px] text-[var(--faint)] hover:text-[var(--rust)]">revoke</button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(JSON.parse(tok.scopes_json) as string[]).map((s) => <Badge key={s} tone="slate">{s}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
