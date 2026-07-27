'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge } from '@/components/ui';
import { api } from '@/lib/api';

export default function CrossProjectLearningPage() {
  const [capability, setCapability] = React.useState<{ available: boolean; projects: string[]; candidates: unknown[] } | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ available: boolean; projects: string[]; candidates: unknown[] }>('/api/learning/cross-project');
    if (res.ok) setCapability(res.data!);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <SectionTitle sub="Discover patterns shared across your projects">Cross-Project Learning</SectionTitle>

      <Card className="mt-4 p-4">
        <div className="flex items-center gap-2">
          <Badge tone={capability?.available ? 'olive' : 'neutral'}>{capability?.available ? 'Available' : 'Unavailable'}</Badge>
          <span className="font-mono text-[11px] text-[var(--dim)]">
            {capability?.available
              ? `Federation active across ${capability.projects.length} projects`
              : 'Cross-project federation not configured'}
          </span>
        </div>
        {capability?.available && (
          <div className="mt-3 flex flex-wrap gap-2">
            {capability.projects.map((p) => (
              <Badge key={p} tone="teal">{p}</Badge>
            ))}
          </div>
        )}
      </Card>

      {capability?.available && (
        <div className="mt-4">
          <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
            {(capability.candidates ?? []).length > 0
              ? `${capability.candidates.length} cross-project candidates available`
              : 'No cross-project candidates yet. Patterns will appear here when detected across projects.'}
          </Card>
        </div>
      )}
    </div>
  );
}
