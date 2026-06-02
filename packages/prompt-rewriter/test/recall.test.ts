// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from '@orqenix/memory-tiers';
import { KeywordRecall } from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('KeywordRecall', () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: MemoryTierStore;
  let recall: KeywordRecall;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-recall-'));
    conn = new SqliteConnection({ path: join(dir, 'r.sqlite') });
    runMigrations(conn, MEMORY_TIER_MIGRATIONS);
    store = new MemoryTierStore({ conn, scopeId: SCOPE });
    recall = new KeywordRecall(store, SCOPE);
    store.insert({ tier: 'episodic', type: 'preference', content: 'I prefer Rust for runtime work', sourceEntryIds: ['ce:1'], confidence: 0.9, scopeId: SCOPE, metadata: {} });
    store.insert({ tier: 'episodic', type: 'decision',  content: 'We decided to use SQLite for storage', sourceEntryIds: ['ce:2'], confidence: 0.85, scopeId: SCOPE, metadata: {} });
    store.insert({ tier: 'semantic', type: 'learning',  content: 'BLAKE3 is faster than SHA-256 for large inputs', sourceEntryIds: ['ce:3'], confidence: 0.95, scopeId: SCOPE, metadata: {} });
    store.insert({ tier: 'working',  type: 'observation', content: 'The sky is blue today',                          sourceEntryIds: ['ce:4'], confidence: 0.4,  scopeId: SCOPE, metadata: {} });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('returns empty for empty tokens', () => {
    expect(recall.recall('a', { k: 5 })).toEqual([]);
  });

  it('finds matches by keyword', () => {
    const r = recall.recall('rust runtime', { k: 5 });
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].content).toContain('Rust');
  });

  it('respects tier filter', () => {
    const r = recall.recall('Rust', { k: 5, tiers: ['working'] });
    expect(r.length).toBe(0);
  });

  it('weights higher-confidence matches', () => {
    const r = recall.recall('SQLite', { k: 5 });
    expect(r[0].content).toContain('SQLite');
  });

  it('returns at most k', () => {
    const r = recall.recall('I we BLAKE3 SQLite Rust sky', { k: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it('records access on returned memories', () => {
    const r1 = recall.recall('Rust', { k: 5 });
    const idBefore = r1[0].id;
    const accessBefore = store.getById(idBefore).accessCount;
    recall.recall('Rust', { k: 5 });
    const accessAfter = store.getById(idBefore).accessCount;
    expect(accessAfter).toBeGreaterThan(accessBefore);
  });
});
