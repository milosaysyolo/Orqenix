import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ChatStore, CHAT_KB_MIGRATIONS, createChatVecTable, SessionNotFoundError, HashChainBrokenError } from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('ChatStore (local mode, no verifier)', () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: ChatStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-chat-'));
    conn = new SqliteConnection({ path: join(dir, 'chat.sqlite'), enableVec: true });
    runMigrations(conn, CHAT_KB_MIGRATIONS);
    createChatVecTable(conn, 4);
    store = new ChatStore({ conn, scopeId: SCOPE });
  });
  afterEach(async () => { conn.close(); await rm(dir, { recursive: true, force: true }); });

  it('creates session', () => {
    const s = store.createSession({ scopeId: SCOPE, title: 'test' });
    expect(s.sessionId).toMatch(/^sess:[A-Z2-7]{32}$/);
    expect(s.entryCount).toBe(0);
  });

  it('append entry updates counters', async () => {
    const s = store.createSession({ scopeId: SCOPE, title: 'x' });
    await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'hi', metadata: {} });
    const refetched = store.getSession(s.sessionId);
    expect(refetched.entryCount).toBe(1);
    expect(refetched.lastEntryAt).not.toBeNull();
  });

  it('hash chain links entries', async () => {
    const s = store.createSession({ scopeId: SCOPE, title: 't' });
    const e1 = await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'one', metadata: {} });
    const e2 = await store.appendEntry({ sessionId: s.sessionId, role: 'assistant', content: 'two', metadata: {} });
    expect(e1.prevEntryHash).toBeNull();
    expect(e2.prevEntryHash).toBe(e1.contentHash);
    await store.verifyHashChain(s.sessionId);
  });

  it('verifyHashChain throws when content tampered in DB', async () => {
    const s = store.createSession({ scopeId: SCOPE, title: 't' });
    await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'orig', metadata: {} });
    conn.prepare(`UPDATE chat_entries SET content = 'tampered' WHERE session_id = ?`).run(s.sessionId);
    await expect(store.verifyHashChain(s.sessionId)).rejects.toThrow(HashChainBrokenError);
  });

  it('listEntries returns in chronological order', async () => {
    const s = store.createSession({ scopeId: SCOPE, title: 't' });
    await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'a', metadata: {} });
    await store.appendEntry({ sessionId: s.sessionId, role: 'assistant', content: 'b', metadata: {} });
    await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'c', metadata: {} });
    const entries = store.listEntries(s.sessionId);
    expect(entries.map((e) => e.content)).toEqual(['a', 'b', 'c']);
  });

  it('throws SessionNotFoundError on missing session', () => {
    expect(() => store.getSession('sess:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' as any)).toThrow(SessionNotFoundError);
  });

  it('vector search returns nearest entry', async () => {
    const s = store.createSession({ scopeId: SCOPE, title: 't' });
    const e1 = await store.appendEntry({ sessionId: s.sessionId, role: 'user', content: 'one', metadata: {} });
    const e2 = await store.appendEntry({ sessionId: s.sessionId, role: 'assistant', content: 'two', metadata: {} });
    store.indexEmbedding(e1.entryId, new Float32Array([1, 0, 0, 0]));
    store.indexEmbedding(e2.entryId, new Float32Array([0, 1, 0, 0]));
    const hits = store.searchByEmbedding(new Float32Array([1, 0, 0, 0]), 1);
    expect(hits[0].entry.entryId).toBe(e1.entryId);
  });
});
