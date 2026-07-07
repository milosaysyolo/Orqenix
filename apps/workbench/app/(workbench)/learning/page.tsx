// SPDX-License-Identifier: Apache-2.0
// Workbench , Self-Learning landing page (UPDATE D8.y.1.3)
// Full spec from D8.y.1.5 (Part 4)

"use client";

import * as React from "react";
import { Sparkles, Eye, Brain, ListChecks } from "lucide-react";
import Link from "next/link";

export default function LearningPage(): React.ReactElement {
  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-orqenix-amber" aria-hidden />
          Self-Learning
        </h1>
        <p className="text-muted-foreground">
          Orqenix observes your workflows, detects recurring patterns, and proposes skills. Review
          candidates, promote the useful ones.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/learning/observer"
          className="rounded-lg border border-border bg-card p-6 hover:border-orqenix-amber/50 transition-colors"
        >
          <Eye className="w-8 h-8 text-orqenix-amber mb-3" aria-hidden />
          <h2 className="font-semibold mb-1">Observer</h2>
          <p className="text-sm text-muted-foreground">
            Configure what Orqenix observes and PII filtering.
          </p>
        </Link>

        <Link
          href="/learning/candidates"
          className="rounded-lg border border-border bg-card p-6 hover:border-orqenix-amber/50 transition-colors"
        >
          <Brain className="w-8 h-8 text-orqenix-amber mb-3" aria-hidden />
          <h2 className="font-semibold mb-1">Candidates</h2>
          <p className="text-sm text-muted-foreground">
            Review detected patterns and promote to skills.
          </p>
        </Link>

        <Link
          href="/learning/insights"
          className="rounded-lg border border-border bg-card p-6 hover:border-orqenix-amber/50 transition-colors"
        >
          <ListChecks className="w-8 h-8 text-orqenix-amber mb-3" aria-hidden />
          <h2 className="font-semibold mb-1">Insights</h2>
          <p className="text-sm text-muted-foreground">
            Verification status, metrics, and manual override.
          </p>
        </Link>
      </div>
    </div>
  );
}
