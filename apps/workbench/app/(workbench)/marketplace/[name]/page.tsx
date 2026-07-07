// SPDX-License-Identifier: Apache-2.0
// Workbench , Plugin detail page (CRUD: Read single + Update + Delete)

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@orqenix/ui-primitives";

export default function PluginDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(String(params.name ?? ""));

  async function handleDelete(): Promise<void> {
    const confirmation = prompt(`Type "DELETE ${name}" to confirm deletion:`);
    if (confirmation !== `DELETE ${name}`) return;
    await fetch("/api/marketplace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", name, confirmation }),
    });
    router.push("/marketplace");
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/marketplace/${encodeURIComponent(name)}/edit`)}
          >
            Update
          </Button>
          <Button variant="ghost" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Plugin detail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Full plugin detail (overview / permissions / conformance / stats) renders here. Data
            loaded via /api/marketplace?action=read&name={name}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
