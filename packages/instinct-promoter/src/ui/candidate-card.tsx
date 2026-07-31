// SPDX-License-Identifier: Apache-2.0
// @orqenix/instinct-promoter/ui , CandidateCard component

"use client";

import * as React from "react";
import { Sparkles, CheckCheck, X, Pause, Pencil, Clock, GitMerge } from "lucide-react";
import { Card, CardContent, Badge, Button } from "@orqenix/ui-primitives";
import type { PromoterCandidate, ReviewAction } from "../types";

export interface CandidateCardProps {
  candidate: PromoterCandidate;
  onReview: (action: ReviewAction) => void;
  busy?: boolean;
}

export function CandidateCard({
  candidate,
  onReview,
  busy,
}: CandidateCardProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="w-4 h-4 text-orqenix-amber" aria-hidden />
              <span className="font-medium text-sm font-mono">{candidate.patternName}</span>
              <Badge variant="default" className="text-xs">
                Impact {candidate.impactScore.toFixed(1)}/10
              </Badge>
              {candidate.crossScope && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <GitMerge className="w-3 h-3" aria-hidden /> Cross-scope
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{candidate.patternDescription}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{candidate.occurrenceCount}× observed</span>
          <span>·</span>
          <span>{(candidate.successRate * 100).toFixed(0)}% success</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden /> ~{candidate.estTimeSavedPerWeekMin} min/week
            saved
          </span>
          {candidate.crossScope && candidate.crossScopeSources.length > 0 && (
            <>
              <span>·</span>
              <span>from {candidate.crossScopeSources.length} projects</span>
            </>
          )}
        </div>

        {/* Samples (collapsible) */}
        <div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => setExpanded(!expanded)}
            disabled={busy}
          >
            {expanded ? "Hide" : "Show"} {candidate.samples.length} sample observations (redacted)
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              {candidate.samples.map((s) => (
                <div key={s.id} className="text-xs">
                  <span className="text-muted-foreground">
                    [{new Date(s.timestamp).toLocaleTimeString()}]
                  </span>{" "}
                  <Badge variant="outline" className="text-xs">
                    {s.actionKind}
                  </Badge>
                  {s.outcomeKind && (
                    <Badge
                      variant={s.outcomeKind === "success" ? "default" : "destructive"}
                      className="text-xs ml-1"
                    >
                      {s.outcomeKind}
                    </Badge>
                  )}
                  <span className="text-muted-foreground/70 ml-1 font-mono">{s.preview}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onReview("promote")} disabled={busy} className="gap-1">
            <CheckCheck className="w-3.5 h-3.5" aria-hidden /> Promote
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReview("promote_customize")}
            disabled={busy}
            className="gap-1"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden /> Customize First
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReview("defer")}
            disabled={busy}
            className="gap-1"
          >
            <Pause className="w-3.5 h-3.5" aria-hidden /> Defer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReview("reject")}
            disabled={busy}
            className="gap-1"
          >
            <X className="w-3.5 h-3.5" aria-hidden /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
