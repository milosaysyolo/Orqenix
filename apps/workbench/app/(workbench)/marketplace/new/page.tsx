// SPDX-License-Identifier: Apache-2.0
// W3.A , Create plugin page — Marketplace CRUD: Create

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SectionTitle, Card, Button } from '@/components/ui';
import { api } from '@/lib/api';

const KINDS = ['skill', 'mcp-server', 'agent', 'subagent', 'agent-binding', 'knowledge-source', 'prompt-rewriter', 'visualization', 'code-analyzer', 'kb-schema'];

export default function NewPluginPage() {
  const router = useRouter();
  const [name, setName] = React.useState('@local/');
  const [kind, setKind] = React.useState('skill');
  const [desc, setDesc] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const valid = /^(@[a-z0-9][\w-]*\/)?[a-z0-9][\w-]+$/.test(name) && name !== '@local/';

  async function create() {
    setBusy(true); setErr(null);
    const res = await api.post('/api/marketplace', {
      action: 'create',
      input: { name, kind, description: desc, permissions: [], external_agent_compat: ['claude-code'],
        tool: { name: name.split('/').pop()?.replace(/-/g, '_'), description: desc, inputSchema: { type: 'object' } } },
    });
    setBusy(false);
    if (res.ok) router.push('/marketplace');
    else setErr(res.error ?? 'create failed');
  }

  return (
    <div className="mx-auto max-w-[680px] px-6 py-6">
      <button onClick={() => router.back()} className="mb-3 font-mono text-[11px] text-[var(--dim)] hover:text-[var(--ink)]">back</button>
      <SectionTitle sub="Define a new local plugin">Create Plugin</SectionTitle>
      <Card className="mt-4 p-5">
        <label className="block">
          <span className="font-mono text-[11px] text-[var(--dim)]">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--rust)]" />
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[11px] text-[var(--dim)]">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px]">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[11px] text-[var(--dim)]">Description</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)}
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--rust)]" />
        </label>
        {err && <div className="mt-2 font-mono text-[10px] text-[var(--rust)]">{err}</div>}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="md" onClick={() => router.push('/marketplace')}>Cancel</Button>
          <Button variant="primary" size="md" onClick={create} disabled={busy || !valid}>{busy ? 'creating...' : 'Create'}</Button>
        </div>
      </Card>
    </div>
  );
}
