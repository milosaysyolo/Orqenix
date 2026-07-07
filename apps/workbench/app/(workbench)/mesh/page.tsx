// SPDX-License-Identifier: Apache-2.0
// Mesh tab , view mesh links and capabilities (LAN + Cloud peers)

"use client";

import { Network, Link2, Shield, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@orqenix/ui-primitives";

export default function MeshPage() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Mesh</h1>
        <p className="text-muted-foreground">
          View mesh links, capability tokens, and peer connections.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Links</CardTitle>
            <Link2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dormant Links</CardTitle>
            <Network className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capabilities Issued</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Awaiting integration</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cloud Peers</CardTitle>
            <Globe className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <Badge variant="secondary" className="mt-1">
              Cloud sync optional
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mesh Topology</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Graph visualization of project/branch/session links with capability flow.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Network className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden />
            <h3 className="font-semibold mb-2">Mesh topology graph</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The force-directed graph + hierarchical + memory flow layouts ship in D8.α.6. Built on
              the canvas engine from D7.5 (Cloud Web Control Plane).
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Charter gate: G58 (Memory Hierarchy , link state engine)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
