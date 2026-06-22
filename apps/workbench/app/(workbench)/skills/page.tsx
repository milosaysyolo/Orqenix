// SPDX-License-Identifier: Apache-2.0
// W3.A , Skills page — registry + invoke + genesis link

'use client';

import * as React from 'react';
import Link from 'next/link';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { api } from '@/lib/api';

interface Skill { package_name: string; version: string; state: string; }

export default function SkillsPage() {
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [result, setResult] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    const res = await api.get<{ skills: Skill[] }>('/api/skills');
    if (res.ok) setSkills(res.data!.skills);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function invoke(name: string) {
    const res = await api.post<{ ok: boolean; recordedAs?: string }>('/api/skills', { action: 'invoke', skillName: name, input: {} });
    setResult((r) => ({ ...r, [name]: res.ok ? `invoked -> ${res.data?.recordedAs}` : (res.error ?? 'failed') }));
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Reusable agent capabilities">Skills</SectionTitle>
        <Link href="/learning"><Button variant="outline" size="sm">Skill Genesis</Button></Link>
      </div>
      {skills.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          No skills installed. Promote a pattern in Learning Hub or install from Marketplace.
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {skills.map((s) => (
            <Card key={s.package_name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[var(--amber)]">*</span>
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{s.package_name}</span>
              <Badge tone="neutral">v{s.version}</Badge>
              <Badge tone={s.state === 'active' ? 'olive' : 'neutral'}>{s.state}</Badge>
              {result[s.package_name] && <span className="font-mono text-[10px] text-[var(--dim)]">{result[s.package_name]}</span>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => invoke(s.package_name)}>{'>'} Invoke</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
