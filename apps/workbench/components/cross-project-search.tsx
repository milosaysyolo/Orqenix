// SPDX-License-Identifier: Apache-2.0
// Cross-project search component
//
// Surfaces cross-project candidates with explicit approval workflow per
// CR v8.0 ADR-E-011 + INV-18.

'use client';

import * as React from 'react';
import { Search, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Label,
  Switch,
} from '@orqenix/ui-primitives';

interface CandidatePreview {
  id: string;
  source_project_id: string;
  source_project_name: string;
  kind: 'chat' | 'code' | 'decision' | 'lesson';
  preview: string;
  relevance: number;
  created_at: string;
}

interface FederationResult {
  candidates: CandidatePreview[];
  projects_queried: string[];
  projects_with_results: string[];
  duration_ms: number;
  cache_hit: boolean;
}

export interface CrossProjectSearchProps {
  /** Called when user clicks "Approve & Share" on a candidate */
  onApprove?: (candidateId: string) => Promise<void>;
  /** Optional pre-filled query */
  initialQuery?: string;
}

export function CrossProjectSearch({
  onApprove,
  initialQuery = '',
}: CrossProjectSearchProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [filterDecision, setFilterDecision] = React.useState(true);
  const [filterLesson, setFilterLesson] = React.useState(true);
  const [filterCode, setFilterCode] = React.useState(false);
  const [filterChat, setFilterChat] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<FederationResult | null>(null);
  const [approvedIds, setApprovedIds] = React.useState<Set<string>>(new Set());

  async function executeSearch() {
    if (query.trim().length === 0) return;

    setLoading(true);
    try {
      const kinds: string[] = [];
      if (filterDecision) kinds.push('decision');
      if (filterLesson) kinds.push('lesson');
      if (filterCode) kinds.push('code');
      if (filterChat) kinds.push('chat');

      const response = await fetch('/api/cross-project/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, kinds, limit: 20 }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as FederationResult;
      setResult(data);
    } catch (err) {
      console.error('cross-project query failed:', err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(candidate: CandidatePreview) {
    if (approvedIds.has(candidate.id)) return;
    try {
      await onApprove?.(candidate.id);
      setApprovedIds(new Set([...approvedIds, candidate.id]));
    } catch (err) {
      console.error('approval failed:', err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Privacy banner per INV-18 */}
      <Card className="border-orqenix-amber/30 bg-orqenix-amber/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="w-5 h-5 text-orqenix-amber mt-0.5 shrink-0"
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Cross-project candidates require explicit approval
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Candidates surface as previews only. Data does not cross
                project boundaries until you click "Approve & Share" per
                candidate. All cross-project queries are recorded in the audit
                chain.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search across opted-in projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search decisions, lessons, code, or chat..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void executeSearch();
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => void executeSearch()}
              disabled={loading || query.trim().length === 0}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* KB kind filters */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Switch
                id="filter-decision"
                checked={filterDecision}
                onCheckedChange={(v: boolean) => setFilterDecision(v)}
              />
              <Label htmlFor="filter-decision">Decisions</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="filter-lesson"
                checked={filterLesson}
                onCheckedChange={(v: boolean) => setFilterLesson(v)}
              />
              <Label htmlFor="filter-lesson">Lessons</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="filter-code"
                checked={filterCode}
                onCheckedChange={(v: boolean) => setFilterCode(v)}
              />
              <Label htmlFor="filter-code">Code</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="filter-chat"
                checked={filterChat}
                onCheckedChange={(v: boolean) => setFilterChat(v)}
              />
              <Label htmlFor="filter-chat">Chat</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Candidates</span>
              <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                <span>{result.candidates.length} found</span>
                <Badge variant="secondary" className="text-xs">
                  {result.duration_ms}ms
                </Badge>
                {result.cache_hit && (
                  <Badge variant="outline" className="text-xs">
                    cached
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.candidates.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No candidates found across {result.projects_queried.length}{' '}
                projects.
              </div>
            ) : (
              <div className="space-y-3">
                {result.candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    approved={approvedIds.has(candidate.id)}
                    onApprove={() => void handleApprove(candidate)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  approved,
  onApprove,
}: {
  candidate: CandidatePreview;
  approved: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {candidate.kind}
            </Badge>
            <span className="text-xs text-muted-foreground">
              from {candidate.source_project_name}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              relevance {(candidate.relevance * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-sm text-foreground line-clamp-3">
            {candidate.preview}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Created {new Date(candidate.created_at).toLocaleString()}
        </span>
        {approved ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="w-3 h-3" aria-hidden /> Approved & Shared
          </Badge>
        ) : (
          <Button size="sm" onClick={onApprove}>
            Approve & Share
          </Button>
        )}
      </div>
    </div>
  );
}
