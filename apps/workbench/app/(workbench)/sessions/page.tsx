// SPDX-License-Identifier: Apache-2.0
// Sessions tab , browse and manage agent sessions

"use client";

import { Activity, Pause, Trash2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@orqenix/ui-primitives";

export default function SessionsPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sessions</h1>
        <p className="text-muted-foreground">
          Browse, resume, and manage agent chat sessions across all branches.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Pause className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting resumption</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">All-time, persisted forever</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Platforms</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Claude / Cursor / etc.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Browser</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            All sessions are persisted forever. Each session has a full Memory × Knowledge matrix.
            Resume any session by clicking it; delete only via explicit user action.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden />
            <h3 className="font-semibold mb-2">Session list scaffold</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Session detail (status, platform, parent_session_id, matrix snapshot, resume action,
              delete with confirmation) ships in D8.α.6.
            </p>
            <div className="flex gap-2 justify-center text-xs mt-4">
              <Badge variant="default">ACTIVE</Badge>
              <Badge variant="secondary">PAUSED</Badge>
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="w-3 h-3" /> DELETED
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Charter gate: G58 (Memory Hierarchy) , session_id, ACTIVE/PAUSED/DELETED states
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
