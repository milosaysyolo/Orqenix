// SPDX-License-Identifier: Apache-2.0
// Workbench , Create new plugin page (Marketplace CRUD: Create)

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
} from "@orqenix/ui-primitives";

const KINDS = [
  "skill",
  "mcp-server",
  "agent",
  "subagent",
  "agent-binding",
  "knowledge-source",
  "embedding-model",
  "reranker",
  "compression-strategy",
  "memory-injection-strategy",
  "prompt-rewriter",
  "visualization",
  "code-analyzer",
  "kb-schema",
];

export default function NewPluginPage(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = React.useState("@local/");
  const [kind, setKind] = React.useState("skill");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleCreate(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          kind,
          description,
          permissions: [],
          external_agent_compat: ["claude-code"],
          tool: {
            name: name.split("/").pop()?.replace(/-/g, "_"),
            description,
            inputSchema: { type: "object" },
          },
        }),
      });
      if (res.ok) router.push("/marketplace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Create Plugin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Plugin details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="@local/my-skill"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <select
              id="kind"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push("/marketplace")}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={busy || name === "@local/"}>
              {busy ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
