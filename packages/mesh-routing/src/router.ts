// SPDX-License-Identifier: Apache-2.0
// @bc CS-023 Router
// @gate G34.2, G34.3, G35.1

import type { ScopeLinkStore } from '@orqenix/scope-link';
import type { HookBus } from '@orqenix/hooks';
import { nowIso } from '@orqenix/hooks';
import { type MetricsRegistry } from '@orqenix/telemetry';
import { verifyChain, ProvenanceChainBrokenError } from '@orqenix/provenance';
import {
  MeshQuerySchema, MeshRoutingError,
  type AutoLinkSuggestion, type MeshQuery, type MeshQueryHit, type MeshQueryResponse,
  type MeshScopeFailure, type MeshScopeOutcome, type MeshScopeResult,
} from './contracts.js';
import type { MeshTransport } from './transport.js';

export interface MeshRouterOptions {
  localScopeId: string;
  linkStore: ScopeLinkStore;
  transport: MeshTransport;
  bus?: HookBus;
  metrics?: MetricsRegistry;
  now?: () => string;
}

export class MeshRouter {
  private readonly localScopeId: string;
  private readonly linkStore: ScopeLinkStore;
  private readonly transport: MeshTransport;
  private readonly bus?: HookBus;
  private readonly metrics?: MetricsRegistry;
  private readonly now: () => string;

  constructor(opts: MeshRouterOptions) {
    this.localScopeId = opts.localScopeId;
    this.linkStore = opts.linkStore;
    this.transport = opts.transport;
    this.bus = opts.bus;
    this.metrics = opts.metrics;
    this.now = opts.now ?? nowIso;
  }

  private resolveTargets(query: MeshQuery): Array<{ scopeId: string; tokenJti?: string }> {
    const activeOutbound = this.linkStore.list({ status: 'active', direction: 'outbound' });
    const map = new Map(activeOutbound.map((l) => [l.remoteScopeId, l.capabilityTokenJti]));
    if (query.targetScopeIds && query.targetScopeIds.length > 0) {
      const out: Array<{ scopeId: string; tokenJti?: string }> = [];
      for (const id of query.targetScopeIds) {
        if (map.has(id)) out.push({ scopeId: id, tokenJti: map.get(id) });
      }
      return out;
    }
    return [...map.entries()].map(([scopeId, tokenJti]) => ({ scopeId, tokenJti }));
  }

  private validateOutcome(outcome: MeshScopeOutcome): MeshScopeOutcome {
    if (!outcome.ok) return outcome;
    const validated: MeshQueryHit[] = [];
    for (const h of outcome.hits) {
      try { verifyChain(h.provenance); validated.push(h); }
      catch (e) {
        if (e instanceof ProvenanceChainBrokenError) {
          // drop the hit silently; record failure metric
          this.metrics?.counter('orqenix.mesh.provenance_drops', { scope: outcome.scopeId }).inc();
          continue;
        }
        throw e;
      }
    }
    return { ...outcome, hits: validated };
  }

  async query(rawQuery: MeshQuery): Promise<MeshQueryResponse> {
    const query = MeshQuerySchema.parse(rawQuery);
    const totalStart = Date.now();

    if (this.bus) {
      await this.bus.emit('preRecall', {
        event: 'preRecall', scopeId: this.localScopeId, timestamp: this.now(),
        query: query.text, k: query.k,
      });
    }

    const targets = this.resolveTargets(query);
    if (targets.length === 0) {
      const out: MeshQueryResponse = {
        query, scopesQueried: 0, scopesSucceeded: 0,
        hits: [], outcomes: [],
        totalDurationMs: Date.now() - totalStart, quorumReached: false,
      };
      if (this.bus) {
        await this.bus.emit('postRecall', {
          event: 'postRecall', scopeId: this.localScopeId, timestamp: this.now(),
          query: query.text, memoryIdsReturned: [], durationMs: out.totalDurationMs,
        });
      }
      return out;
    }

    const promises = targets.map((t) =>
      this.transport.queryScope(t.scopeId, query, { tokenJti: t.tokenJti, timeoutMs: query.timeoutMs }),
    );
    const settled = await Promise.allSettled(promises);
    const outcomes: MeshScopeOutcome[] = [];
    for (let i = 0; i < settled.length; i++) {
      const t = targets[i]!;
      const s = settled[i]!;
      if (s.status === 'fulfilled') {
        outcomes.push(this.validateOutcome(s.value));
      } else {
        const failure: MeshScopeFailure = {
          scopeId: t.scopeId, ok: false, reason: 'unknown',
          message: (s.reason as Error)?.message ?? 'rejected',
          durationMs: 0,
        };
        outcomes.push(failure);
      }
    }

    const succeeded = outcomes.filter((o): o is MeshScopeResult => o.ok);
    const aggregated: MeshQueryHit[] = [];
    for (const s of succeeded) aggregated.push(...s.hits);
    aggregated.sort((a, b) => b.score - a.score);
    const topK = aggregated.slice(0, query.k);

    const scopesSucceeded = succeeded.length;
    const quorumReached = scopesSucceeded >= Math.ceil(targets.length / 2);
    const totalDurationMs = Date.now() - totalStart;

    if (this.metrics) {
      const labels = { scope: this.localScopeId };
      this.metrics.counter('orqenix.mesh.query_runs', labels).inc();
      this.metrics.histogram('orqenix.mesh.query_duration_ms', labels).observe(totalDurationMs);
      for (const o of outcomes) {
        if (!o.ok) {
          this.metrics.counter('orqenix.mesh.scope_failures', { scope: this.localScopeId, target: o.scopeId, reason: o.reason }).inc();
        }
      }
    }

    if (this.bus) {
      await this.bus.emit('postRecall', {
        event: 'postRecall', scopeId: this.localScopeId, timestamp: this.now(),
        query: query.text, memoryIdsReturned: [], durationMs: totalDurationMs,
      });
    }

    return {
      query, scopesQueried: targets.length, scopesSucceeded,
      hits: topK, outcomes, totalDurationMs, quorumReached,
    };
  }

  suggestLinks(history: MeshQueryResponse[]): AutoLinkSuggestion[] {
    if (history.length === 0) return [];

    const perScope = new Map<string, { runs: number; failures: number; scoreSum: number; hitCount: number }>();
    for (const h of history) {
      for (const o of h.outcomes) {
        const cur = perScope.get(o.scopeId) ?? { runs: 0, failures: 0, scoreSum: 0, hitCount: 0 };
        cur.runs++;
        if (!o.ok) cur.failures++;
        else {
          for (const hit of o.hits) { cur.scoreSum += hit.score; cur.hitCount++; }
        }
        perScope.set(o.scopeId, cur);
      }
    }

    const suggestions: AutoLinkSuggestion[] = [];
    const avgScores: Array<{ id: string; avg: number }> = [];
    for (const [id, s] of perScope.entries()) {
      const failRatio = s.runs > 0 ? s.failures / s.runs : 0;
      if (s.runs >= 5 && failRatio >= 0.6) {
        suggestions.push({
          scopeId: id, reason: 'frequent-failure',
          evidence: { sampleSize: s.runs, ratio: failRatio },
        });
      }
      const avgScore = s.hitCount > 0 ? s.scoreSum / s.hitCount : 0;
      if (s.hitCount >= 3) avgScores.push({ id, avg: avgScore });
    }

    avgScores.sort((a, b) => b.avg - a.avg);
    const topCount = avgScores.length > 0 ? Math.max(1, Math.floor(avgScores.length / 4)) : 0;
    for (let i = 0; i < topCount; i++) {
      const s = perScope.get(avgScores[i]!.id)!;
      const failRatio = s.failures / Math.max(1, s.runs);
      // skip if already a frequent-failure
      if (failRatio >= 0.6) continue;
      suggestions.push({
        scopeId: avgScores[i]!.id, reason: 'high-relevance',
        evidence: { sampleSize: s.hitCount, ratio: avgScores[i]!.avg },
      });
    }

    return suggestions;
  }
}

export { MeshRoutingError };
