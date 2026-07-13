'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface MeshPeer {
  id: string; name: string; address: string; transport: string;
  latency: number; connected: boolean;
}

export default function MeshPage() {
  const [peers, setPeers] = React.useState<MeshPeer[]>([]);

  const load = React.useCallback(async () => {
    const res = await api.get<{ peers: MeshPeer[] }>('/api/mesh');
    if (res.ok) setPeers(res.data!.peers);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <SectionTitle sub="Federated peers and cross-scope links">Mesh</SectionTitle>

      <Card className="mt-4 border-[color-mix(in_oklab,var(--amber)35%,transparent)] bg-[color-mix(in_oklab,var(--amber)4%,var(--card))] p-3">
        <div className="font-mono text-[10.5px] text-[var(--dim)]">
          Cross-project memories are shown but never shared without explicit per-pair approval (INV-18).
        </div>
      </Card>

      {peers.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          No peers in mesh.
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {peers.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.connected ? 'var(--olive)' : 'var(--faint)' }} />
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{p.name}</span>
              <Badge tone={p.connected ? 'olive' : 'neutral'}>{p.connected ? 'connected' : 'offline'}</Badge>
              <span className="font-mono text-[10px] text-[var(--dim)]">{p.address}</span>
              <span className="font-mono text-[9.5px] text-[var(--faint)]">{p.transport}</span>
              <span className="ml-auto font-mono text-[10px] text-[var(--dim)]">{p.latency}ms</span>
              {!p.connected && <Button variant="outline" size="sm">Reconnect</Button>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
