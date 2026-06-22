// SPDX-License-Identifier: Apache-2.0
// W3.A , Import wizard — normalization from 14 input adapters

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SectionTitle, Card, Button } from '@/components/ui';
import { api } from '@/lib/api';

const SOURCES = ['auto-detect', 'claude-code', 'cursor', 'codex', 'opencode', 'mcp', 'continue', 'aider', 'cline', 'npm', 'github', 'url', 'user-custom'];

export default function ImportPage() {
  const router = useRouter();
  const [sourceKind, setSourceKind] = React.useState('auto-detect');
  const [content, setContent] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function doImport() {
    setBusy(true); setMsg(null);
    const res = await api.post<{ ok: boolean; pluginName?: string; adapterKind?: string; warnings?: string[] }>('/api/marketplace', {
      action: 'import',
      input: { ...(sourceKind !== 'auto-detect' ? { sourceKind } : {}), ...(url ? { url } : {}), ...(content ? { content } : {}) },
    });
    setBusy(false);
    if (res.ok && res.data?.ok) {
      setMsg(`Imported ${res.data.pluginName} via ${res.data.adapterKind}${(res.data?.warnings?.length ?? 0) ? ' * warnings: ' + res.data.warnings!.join('; ') : ''}`);
    } else setMsg(res.error ?? (res.data?.warnings?.join('; ') ?? 'import failed'));
  }

  return (
    <div className="mx-auto max-w-[680px] px-6 py-6">
      <button onClick={() => router.back()} className="mb-3 font-mono text-[11px] text-[var(--dim)] hover:text-[var(--ink)]">back</button>
      <SectionTitle sub="Bring a plugin from another format into CSF">Import Plugin</SectionTitle>
      <Card className="mt-4 p-5 space-y-3">
        <label className="block">
          <span className="font-mono text-[11px] text-[var(--dim)]">Source format</span>
          <select value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px]">
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-[var(--dim)]">URL (npm / github / direct)</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--rust)]" />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-[var(--dim)]">Or paste content</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="paste plugin definition..."
            className="mt-1 w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--rust)]" />
        </label>
        {msg && <div className="font-mono text-[10px] text-[var(--rust)]">{msg}</div>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="md" onClick={() => router.push('/marketplace')}>Cancel</Button>
          <Button variant="primary" size="md" onClick={doImport} disabled={busy}>{busy ? 'importing...' : 'Import'}</Button>
        </div>
      </Card>
    </div>
  );
}
