// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// DASHBOARD CONTENT — client wrapper around the collapsible dashboard sidebar.
// The page is a Server Component; this is the "use client" island that holds
// the sidebar collapse state. All other dashboard children stay as they were.
// ============================================================================

'use client';

import * as React from 'react';
import { CollapseToggle } from '@/components/collapse-toggle';
import { ContextPipeline } from '@/components/dashboard/context-pipeline';
import { MatrixViz } from '@/components/dashboard/matrix-viz';
import { AgentActivity } from '@/components/dashboard/agent-activity';
import { MeshStatus } from '@/components/dashboard/mesh-status';
import { RecentLearning } from '@/components/dashboard/recent-learning';
import { ActivityHeatmap } from '@/components/live/activity-heatmap';
import type { LearningCandidate } from '@/lib/demo-store';

export function DashboardContent({
  matrix,
  learning,
}: {
  matrix: Record<string, Record<string, number>>;
  learning: LearningCandidate[];
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="mt-5 flex gap-5">
      {/* Main content column */}
      <div className="min-w-0 flex-1 space-y-5">
        <ContextPipeline />
        <MatrixViz matrix={matrix} />
        <ActivityHeatmap />
      </div>

      {/* Sidebar column – collapsible on desktop */}
      <div className="hidden lg:block shrink-0 relative">
        {/* Expanded panel */}
        <div
          className="overflow-hidden transition-all duration-200"
          style={{
            width: sidebarOpen ? 280 : 0,
            opacity: sidebarOpen ? 1 : 0,
          }}
        >
          <div className="w-[280px] space-y-4">
            <AgentActivity />
            <MeshStatus peers={2} />
            <RecentLearning items={learning} />
          </div>
        </div>

        {/* Floating collapse button (visible when panel is open) */}
        <div
          className="absolute top-3 z-10 transition-all duration-200"
          style={{
            left: sidebarOpen ? 268 : -9999,
            opacity: sidebarOpen ? 1 : 0,
            pointerEvents: sidebarOpen ? 'auto' : 'none',
            transform: sidebarOpen ? 'scale(1)' : 'scale(0.85)',
          }}
        >
          <CollapseToggle collapsed={false} onToggle={() => setSidebarOpen(false)} side="right" label="Collapse sidebar" />
        </div>

        {/* Standalone expand button (visible when panel is collapsed) */}
        <div
          className="absolute left-1 top-3 z-10 flex items-center gap-2 transition-all duration-200"
          style={{
            opacity: sidebarOpen ? 0 : 1,
            pointerEvents: sidebarOpen ? 'none' : 'auto',
            transform: sidebarOpen ? 'translateX(-8px) scale(0.85)' : 'translateX(0) scale(1)',
          }}
        >
          <span className="h-px w-3 bg-[var(--line)]" />
          <CollapseToggle collapsed={true} onToggle={() => setSidebarOpen(true)} side="right" label="Show sidebar" />
          <span className="h-px w-3 bg-[var(--line)]" />
        </div>
      </div>
    </div>
  );
}
