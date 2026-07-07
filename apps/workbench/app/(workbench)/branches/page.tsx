// SPDX-License-Identifier: Apache-2.0
// Branches tab , browse branches and manage memory hierarchy

"use client";

import { GitBranch, Copy, Trash2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@orqenix/ui-primitives";

export default function BranchesPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Branches</h1>
          <p className="text-muted-foreground">
            Browse git branches with their memory matrices. Branch creation = deep copy at creation
            time.
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <GitBranch className="w-4 h-4" />
          Inspect Git State
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branches</CardTitle>
            <GitBranch className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting D8.α.6</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Branch</CardTitle>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Detected from git HEAD</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Entries</CardTitle>
            <Copy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Across all branches</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Tree</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Branches are lazily created when observer detects activity. Each branch has independent
            memory indexes; blob content is deduplicated via BLAKE3 content addressing.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden />
            <h3 className="font-semibold mb-2">Branch tree visualization</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Branch tree with parent-child relationships, deep copy provenance, and per-branch
              memory matrix counts ships in D8.α.6.
            </p>
            <div className="flex gap-2 justify-center text-xs">
              <Badge variant="default" className="gap-1">
                <GitBranch className="w-3 h-3" /> Active
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Copy className="w-3 h-3" /> Cloned
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <Trash2 className="w-3 h-3" /> Deleted
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Charter gate: G59 (Branch Deep Copy + Audit Continuity) , 8 sub-criteria
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
