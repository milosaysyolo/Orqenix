// SPDX-License-Identifier: Apache-2.0
// Cross-Project page , Workbench top-level navigation entry
//
// Per CR v8.0 Section 10.8.2, Workbench has 8 top-level tabs.
// This page adds the cross-project federation surface.

import { Globe2 } from 'lucide-react';
import { CrossProjectSearch } from '@/components/cross-project-search';

export const metadata = {
  title: 'Cross-Project Federation , Orqenix Workbench',
  description:
    'Search and approve candidates across opted-in projects. Pull-on-demand cross-project memory federation.',
};

export default function CrossProjectPage() {
  async function handleApprove(candidateId: string): Promise<void> {
    'use server';
    // Server action wires to FederationEngine.approveCandidate()
    // Implementation lives in apps/workbench/app/api/cross-project/approve/route.ts
    // (added in D8.α.6 when Memory Engine wires actual ingestion)
    const response = await fetch('/api/cross-project/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateId }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Globe2 className="w-7 h-7 text-orqenix-emerald" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">
            Cross-Project Federation
          </h1>
        </div>
        <p className="text-muted-foreground">
          Pull-on-demand memory federation across projects you have explicitly
          opted in. Strictly approval-based per project pair.
        </p>
      </header>

      <CrossProjectSearch onApprove={handleApprove} />

      <footer className="mt-12 text-xs text-muted-foreground border-t border-border pt-6 space-y-2">
        <p>
          Per CR v8.0 ADR-E-011 and INV-18, cross-project candidates surface as
          previews only. Data does not move between projects until you click{' '}
          <strong>Approve &amp; Share</strong>.
        </p>
        <p>
          Configure project registry and approvals in{' '}
          <code className="text-foreground">~/.orqenix/projects.yaml</code> and{' '}
          <code className="text-foreground">
            ~/.orqenix/federation-approvals.yaml
          </code>
          .
        </p>
        <p>
          All cross-project queries and approvals are recorded in the audit
          chain. Charter gates: G58-09, G58-10, G58-11.
        </p>
      </footer>
    </div>
  );
}
