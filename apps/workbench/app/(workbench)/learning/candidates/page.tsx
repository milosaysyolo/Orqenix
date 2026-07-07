// SPDX-License-Identifier: Apache-2.0
// Workbench , Self-Learning Candidates page (Promoter UI)

"use client";

import * as React from "react";
import { Sparkles, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@orqenix/ui-primitives";
import { CandidateList } from "@orqenix/instinct-promoter/ui";
import type { PromoterCandidate, ReviewAction } from "@orqenix/instinct-promoter";

export default function CandidatesPage(): React.ReactElement {
  const [candidates, setCandidates] = React.useState<PromoterCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void load();
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/candidates");
      if (res.ok) {
        const data = (await res.json()) as { candidates: PromoterCandidate[] };
        setCandidates(data.candidates);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(candidateId: string, action: ReviewAction): Promise<void> {
    const res = await fetch("/api/learning/candidates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId, action, reviewedBy: "local-user" }),
    });
    if (res.ok) {
      const data = (await res.json()) as { openBuilder?: boolean; generatedSkillName?: string };
      if (data.openBuilder) {
        window.location.href = `/marketplace/new?fromCandidate=${candidateId}`;
        return;
      }
      await load(); // refresh
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-orqenix-amber" aria-hidden />
          Candidate Patterns
        </h1>
        <p className="text-muted-foreground">
          Recurring workflows detected by the observer, ranked by impact. Promote useful ones to
          skills.
        </p>
      </div>

      <Card className="mb-6 border-orqenix-amber/30 bg-orqenix-amber/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-orqenix-amber mt-0.5 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">Promoted skills require verification</p>
              <p className="text-xs text-muted-foreground mt-1">
                Per Anti-pattern 38, a promoted skill is created as <strong>unverified</strong>. It
                must pass the verification loop (replay + cross-validation) before becoming
                default-enabled. Observation samples are PII-redacted.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <CandidateList candidates={candidates} onReview={handleReview} loading={loading} />
    </div>
  );
}
