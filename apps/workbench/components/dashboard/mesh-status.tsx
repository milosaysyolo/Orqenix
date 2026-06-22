// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: apps/workbench/components/dashboard/mesh-status.tsx
// Purpose: Small Dashboard card showing linked scopes / mesh peers count, linking
//   to /mesh. Minimal in W2; full mesh wiring in W3.
// Rules: 'use client'. Two linked scope chips + online dots.
// ============================================================================

'use client';

import Link from 'next/link';
import { Panel, Badge } from '@/components/ui';

export function MeshStatus({ peers = 0 }: { peers?: number }) {
  return (
    <Panel
      title="Mesh Status"
      action={<Link href="/mesh" className="text-[10.5px] text-[var(--rust)] hover:underline">open →</Link>}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--olive)]" />
        <span className="font-mono text-[11.5px] text-[var(--ink)]">{peers} linked scopes</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone="teal">project/auth-service</Badge>
        <Badge tone="slate">shared/security</Badge>
      </div>
    </Panel>
  );
}
