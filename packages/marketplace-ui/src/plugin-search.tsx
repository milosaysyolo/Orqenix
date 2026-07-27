// SPDX-License-Identifier: Apache-2.0
// @orqenix/marketplace-ui , PluginSearch component

"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input, Button, Badge } from "@orqenix/ui-primitives";
import type { MarketplaceSearchFilters } from "./types";

const ALL_KINDS = [
  "knowledge-source",
  "embedding-model",
  "reranker",
  "compression-strategy",
  "memory-injection-strategy",
  "prompt-rewriter",
  "visualization",
  "code-analyzer",
  "kb-schema",
  "mcp-server",
  "agent",
  "subagent",
  "skill",
  "agent-binding",
];

export interface PluginSearchProps {
  onSearch: (query: string, filters: MarketplaceSearchFilters) => void;
  loading?: boolean;
}

export function PluginSearch({ onSearch, loading }: PluginSearchProps): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [selectedKinds, setSelectedKinds] = React.useState<Set<string>>(new Set());

  function doSearch(): void {
    onSearch(query, {
      kinds: Array.from(selectedKinds),
      verifiedOnly,
      sources: [],
    });
  }

  function toggleKind(kind: string): void {
    const next = new Set(selectedKinds);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setSelectedKinds(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder="Search plugins across registries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
            className="pl-9"
          />
        </div>
        <Button onClick={doSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={verifiedOnly ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
        >
          Verified only
        </Badge>
        {ALL_KINDS.map((kind) => (
          <Badge
            key={kind}
            variant={selectedKinds.has(kind) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => toggleKind(kind)}
          >
            {kind}
          </Badge>
        ))}
      </div>
    </div>
  );
}
