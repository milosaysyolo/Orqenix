// SPDX-License-Identifier: Apache-2.0
// Memory tab , browse hierarchical memory matrices (project → branch → session)

'use client';

import { Brain, Database, Layers, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@orqenix/ui-primitives';

export default function MemoryPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Memory</h1>
        <p className="text-muted-foreground">
          Browse hierarchical memory matrices across projects, branches, and sessions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Memory</CardTitle>
            <Brain className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting D8.α.6 implementation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branches</CardTitle>
            <Layers className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting D8.α.6 implementation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting D8.α.6 implementation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Entries</CardTitle>
            <Search className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting D8.α.6 implementation</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Memory × Knowledge Matrix</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            4 tiers × 4 KBs (Chat / Code / Decision / Lesson) applied at every hierarchy level.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden />
            <h3 className="font-semibold mb-2">Memory matrix scaffold</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The hierarchical memory matrix viewer ships in D8.α.6. This placeholder confirms
              the Memory tab is wired and routable.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Charter gate: G58 (Memory Hierarchy) , 18 sub-criteria
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
