'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Project { id: string; name: string; sharing: boolean; online: boolean; self?: boolean; }

export default function CrossProjectPage() {
  const [projects, setProjects] = React.useState<Project[]>([]);

  const load = React.useCallback(async () => {
    const res = await api.get<{ projects: Project[] }>('/api/cross-project');
    if (res.ok) setProjects(res.data!.projects);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <SectionTitle sub="Federated memory across projects">Cross-Project Federation</SectionTitle>

      <Card className="mt-4 border-[color-mix(in_oklab,var(--amber)35%,transparent)] bg-[color-mix(in_oklab,var(--amber)4%,var(--card))] p-3">
        <div className="font-mono text-[10.5px] text-[var(--dim)]">
          Pull-on-demand memory federation across opted-in projects. Strictly approval-based per project pair (INV-18).
        </div>
      </Card>

      <div className="mt-4 space-y-2">
        {projects.map((p) => (
          <Card key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.online ? 'var(--olive)' : 'var(--faint)' }} />
            <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{p.name}</span>
            <span className="font-mono text-[10px] text-[var(--faint)]">{p.id.slice(0, 18)}&hellip;</span>
            {p.self && <Badge tone="teal">self</Badge>}
            <Badge tone={p.sharing ? 'olive' : 'neutral'}>{p.sharing ? 'sharing on' : 'sharing off'}</Badge>
            {!p.self && <Button variant="outline" size="sm" className="ml-auto">Request link</Button>}
          </Card>
        ))}
      </div>
    </div>
  );
}
