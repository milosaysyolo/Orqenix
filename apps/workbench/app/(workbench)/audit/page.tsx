// SPDX-License-Identifier: Apache-2.0
// Audit tab , browse audit chain and verify integrity

'use client';

import { ShieldCheck, FileText, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@orqenix/ui-primitives';

export default function AuditPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Audit</h1>
          <p className="text-muted-foreground">
            Browse audit chain entries and verify integrity with BLAKE3 hash chain.
          </p>
        </div>
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="w-3 h-3" />
          Chain Integrity: —
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log Browser</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            BLAKE3 hash-chained audit log with filtering by branch_id, session_id, kind, actor.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden />
            <h3 className="font-semibold mb-2">Audit chain browser</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Full audit log browser with chain verifier (BLAKE3, 1M entries in 24s) ships in D8.α.4.
              Reuses AuditChainVerifier Web Worker from Phase 7 D7.5.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Charter gate: G58 + G61 (Workbench UI integration)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
