// SPDX-License-Identifier: Apache-2.0
// @orqenix/instinct-promoter/ui , CandidateList component

"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { CandidateCard } from "./candidate-card";
import type { PromoterCandidate, ReviewAction } from "../types";

export interface CandidateListProps {
  candidates: PromoterCandidate[];
  onReview: (candidateId: string, action: ReviewAction) => Promise<void>;
  loading?: boolean;
}

export function CandidateList({
  candidates,
  onReview,
  loading,
}: CandidateListProps): React.ReactElement {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function handleReview(candidateId: string, action: ReviewAction): Promise<void> {
    setBusyId(candidateId);
    try {
      await onReview(candidateId, action);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">Loading candidates...</div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" aria-hidden />
        No candidate patterns yet. Keep working , the observer will surface recurring workflows.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((c) => (
        <CandidateCard
          key={c.id}
          candidate={c}
          onReview={(action) => void handleReview(c.id, action)}
          busy={busyId === c.id}
        />
      ))}
    </div>
  );
}
