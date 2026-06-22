'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SectionTitle, Card, Button } from '@/components/ui';
import { api } from '@/lib/api';

export default function PluginDetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(String(params.name ?? ''));
  const [note, setNote] = React.useState<string | null>(null);

  async function del() {
    const confirmation = prompt(`Type "DELETE ${name}" to confirm:`);
    if (confirmation !== `DELETE ${name}`) { setNote('confirmation mismatch'); return; }
    const res = await api.post('/api/marketplace', { action: 'delete', input: { name, confirmation } });
    if (res.ok) router.push('/marketplace'); else setNote(res.error ?? 'delete failed');
  }
  async function fork() {
    const newName = prompt(`Fork ${name} as:`, `@local/${name.split('/').pop()}-fork`);
    if (!newName) return;
    const res = await api.post('/api/marketplace', { action: 'fork', input: { sourceName: name, newName } });
    setNote(res.ok ? `forked \u2192 ${newName}` : (res.error ?? 'fork failed'));
  }
  async function exportPlugin() {
    const res = await api.post<{ ok: boolean; output?: string; lossyFields: string[] }>('/api/marketplace', { action: 'export', input: { pluginName: name, targetKind: 'npm', acceptLossy: false } });
    if (res.ok && res.data?.output) {
      const blob = new Blob([res.data.output], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `${name.split('/').pop()}.json`; a.click(); URL.revokeObjectURL(url);
    } else if ((res.data?.lossyFields?.length ?? 0) > 0) {
      setNote(`lossy export: ${res.data!.lossyFields.join(', ')}`);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-6 py-6">
      <button onClick={() => router.back()} className="mb-3 font-mono text-[11px] text-[var(--dim)] hover:text-[var(--ink)]">\u2190 back</button>
      <SectionTitle>{name}</SectionTitle>
      {note && <div className="mt-2 font-mono text-[10px] text-[var(--rust)]">{note}</div>}
      <Card className="mt-4 p-5">
        <p className="text-[12px] text-[var(--dim)]">Plugin detail (overview / permissions / conformance) renders here from /api/marketplace.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/marketplace/${encodeURIComponent(name)}/edit`}><Button variant="outline" size="sm">Update</Button></Link>
          <Button variant="outline" size="sm" onClick={fork}>Fork</Button>
          <Button variant="outline" size="sm" onClick={exportPlugin}>Export</Button>
          <Button variant="danger" size="sm" onClick={del}>Delete</Button>
        </div>
      </Card>
    </div>
  );
}