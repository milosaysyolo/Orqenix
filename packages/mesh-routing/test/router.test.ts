// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { rootTag, appendTag, type ProvenanceChain } from '@orqenix/provenance';
import { MeshRouter, InMemoryMeshTransport, type MeshQueryHit } from '../src';

const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const D = 'scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

function provFor(scopeId: string): ProvenanceChain {
  return rootTag({ sourceScopeId: scopeId, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' });
}

function hit(scopeId: string, text: string, score: number): MeshQueryHit {
  return { scopeId, text, score, provenance: provFor(scopeId) };
}

describe('MeshRouter', () => {
  let dir: string;
  let conn: SqliteConnection;
  let linkStore: ScopeLinkStore;
  let transport: InMemoryMeshTransport;
  let router: MeshRouter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-mr-'));
    conn = new SqliteConnection({ path: join(dir, 'mr.sqlite') });
    runMigrations(conn, SCOPE_LINK_MIGRATIONS);
    linkStore = new ScopeLinkStore({ conn, localScopeId: A });
    transport = new InMemoryMeshTransport();
    router = new MeshRouter({ localScopeId: A, linkStore, transport });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  function activateLink(remote: string): void {
    linkStore.create({ remoteScopeId: remote, direction: 'outbound' });
    linkStore.updateStatus(remote, 'outbound', 'active');
  }

  it('returns empty response when no active links', async () => {
    const r = await router.query({ text: 'hello', k: 5, timeoutMs: 1000 });
    expect(r.scopesQueried).toBe(0);
    expect(r.hits).toEqual([]);
    expect(r.quorumReached).toBe(false);
  });

  it('fans out to active outbound links in parallel', async () => {
    activateLink(B);
    activateLink(C);
    transport.setHandler(B, async () => [hit(B, 'from B', 0.9)]);
    transport.setHandler(C, async () => [hit(C, 'from C', 0.8)]);
    const r = await router.query({ text: 'hi', k: 5, timeoutMs: 1000 });
    expect(r.scopesQueried).toBe(2);
    expect(r.scopesSucceeded).toBe(2);
    expect(r.hits.map((h) => h.text)).toEqual(['from B', 'from C']);
    expect(r.quorumReached).toBe(true);
  });

  it('respects targetScopeIds filter (intersection with active links)', async () => {
    activateLink(B);
    activateLink(C);
    transport.setHandler(B, async () => [hit(B, 'b-hit', 1)]);
    transport.setHandler(C, async () => [hit(C, 'c-hit', 1)]);
    const r = await router.query({ text: 'hi', k: 5, timeoutMs: 1000, targetScopeIds: [B, D] });
    expect(r.scopesQueried).toBe(1);
    expect(r.hits.map((h) => h.scopeId)).toEqual([B]);
  });

  it('aggregates and sorts hits by score descending', async () => {
    activateLink(B);
    activateLink(C);
    transport.setHandler(B, async () => [hit(B, 'low', 0.2), hit(B, 'med', 0.5)]);
    transport.setHandler(C, async () => [hit(C, 'high', 0.95)]);
    const r = await router.query({ text: 'q', k: 3, timeoutMs: 1000 });
    expect(r.hits.map((h) => h.score)).toEqual([0.95, 0.5, 0.2]);
  });

  it('respects k cap on aggregated hits', async () => {
    activateLink(B);
    transport.setHandler(B, async () => Array.from({ length: 20 }, (_, i) => hit(B, `t${i}`, 1 - i * 0.01)));
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 1000 });
    expect(r.hits).toHaveLength(5);
  });

  it('records timeout outcome per-target', async () => {
    activateLink(B);
    transport.setHandler(B, async () => new Promise((resolve) => setTimeout(() => resolve([hit(B, 'late', 1)]), 500)) as Promise<MeshQueryHit[]>);
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 100 });
    const o = r.outcomes[0];
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.reason).toBe('timeout');
  });

  it('drops hits with broken provenance chain', async () => {
    activateLink(B);
    const validHit = hit(B, 'valid', 1);
    const tampered: MeshQueryHit = { ...hit(B, 'tampered', 0.99) };
    tampered.provenance = { ...tampered.provenance, chainHash: 'f'.repeat(64) as any };
    transport.setHandler(B, async () => [validHit, tampered]);
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 1000 });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].text).toBe('valid');
  });

  it('accepts a 2-tag provenance chain (mesh hop)', async () => {
    activateLink(B);
    const root = rootTag({ sourceScopeId: B, producedAt: '2026-06-02T00:00:00Z', sourceKind: 'local' });
    const meshHop = appendTag(root, {
      sourceScopeId: A, producedAt: '2026-06-02T00:00:01Z', sourceKind: 'mesh',
      tokenJti: 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    });
    transport.setHandler(B, async () => [{ scopeId: B, text: 'forwarded', score: 0.7, provenance: meshHop }]);
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 1000 });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].text).toBe('forwarded');
  });

  it('quorum requires ceil(scopesQueried/2) successes', async () => {
    activateLink(B); activateLink(C); activateLink(D);
    transport.setHandler(B, async () => [hit(B, 'ok', 1)]);
    transport.setHandler(C, () => { throw new Error('down'); });
    transport.setHandler(D, () => { throw new Error('down'); });
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 1000 });
    expect(r.scopesQueried).toBe(3);
    expect(r.scopesSucceeded).toBe(1);
    expect(r.quorumReached).toBe(false);
  });

  it('skips inbound and pending links when resolving targets', async () => {
    activateLink(B);
    linkStore.create({ remoteScopeId: C, direction: 'outbound' }); // pending
    linkStore.create({ remoteScopeId: D, direction: 'inbound' });
    linkStore.updateStatus(D, 'inbound', 'active');
    transport.setHandler(B, async () => [hit(B, 'only', 1)]);
    transport.setHandler(C, async () => [hit(C, 'pending', 1)]);
    transport.setHandler(D, async () => [hit(D, 'inbound', 1)]);
    const r = await router.query({ text: 'q', k: 5, timeoutMs: 1000 });
    expect(r.scopesQueried).toBe(1);
    expect(r.hits[0].scopeId).toBe(B);
  });

  describe('suggestLinks', () => {
    it('suggests frequent-failure for scopes failing >= 60% over >= 5 runs', () => {
      const history = Array.from({ length: 5 }, () => ({
        query: { text: 'q', k: 5, timeoutMs: 1000 } as any,
        scopesQueried: 1, scopesSucceeded: 0,
        hits: [], outcomes: [{ scopeId: B, ok: false, reason: 'timeout', message: 't', durationMs: 100 } as any],
        totalDurationMs: 100, quorumReached: false,
      }));
      const sug = router.suggestLinks(history);
      expect(sug.some((s) => s.reason === 'frequent-failure' && s.scopeId === B)).toBe(true);
    });

    it('suggests high-relevance for top-quartile avg score scopes', () => {
      const history = Array.from({ length: 4 }, () => ({
        query: { text: 'q', k: 5, timeoutMs: 1000 } as any,
        scopesQueried: 2, scopesSucceeded: 2,
        hits: [],
        outcomes: [
          { scopeId: B, ok: true, hits: [hit(B, 'a', 0.95), hit(B, 'b', 0.90)], durationMs: 10 } as any,
          { scopeId: C, ok: true, hits: [hit(C, 'a', 0.30)], durationMs: 10 } as any,
        ],
        totalDurationMs: 10, quorumReached: true,
      }));
      const sug = router.suggestLinks(history);
      expect(sug.some((s) => s.reason === 'high-relevance' && s.scopeId === B)).toBe(true);
    });

    it('returns empty on empty history', () => {
      expect(router.suggestLinks([])).toEqual([]);
    });
  });
});
