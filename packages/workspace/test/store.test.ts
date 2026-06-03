// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import {
  WorkspaceStore, WORKSPACE_MIGRATIONS,
  WorkspaceNotFoundError, MembershipAlreadyExistsError, MembershipNotFoundError, OwnerRemovalError,
} from '../src';

const A = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

describe('WorkspaceStore', () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: WorkspaceStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-ws-'));
    conn = new SqliteConnection({ path: join(dir, 'ws.sqlite') });
    runMigrations(conn, WORKSPACE_MIGRATIONS);
    store = new WorkspaceStore({ conn });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it('creates workspace + owner membership in one transaction', () => {
    const w = store.create({ name: 'team-alpha', ownerScopeId: A });
    expect(w.id).toMatch(/^ws:[A-Z2-7]{32}$/);
    expect(w.ownerScopeId).toBe(A);
    const members = store.listMembers(w.id as any);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
  });

  it('get throws on missing workspace', () => {
    expect(() => store.get('ws:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' as any)).toThrow(WorkspaceNotFoundError);
  });

  it('addMember rejects duplicates', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'contributor');
    expect(() => store.addMember(w.id as any, B, 'observer')).toThrow(MembershipAlreadyExistsError);
  });

  it('removeMember refuses owner', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    expect(() => store.removeMember(w.id as any, A)).toThrow(OwnerRemovalError);
  });

  it('removeMember works for contributor', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'contributor');
    expect(store.removeMember(w.id as any, B)).toBe(true);
    expect(() => store.getMember(w.id as any, B)).toThrow(MembershipNotFoundError);
  });

  it('listForScope returns all workspaces containing the scope', () => {
    const w1 = store.create({ name: 'x', ownerScopeId: A });
    const w2 = store.create({ name: 'y', ownerScopeId: A });
    store.addMember(w1.id as any, B, 'contributor');
    expect(store.listForScope(B).map((w) => w.id).sort()).toEqual([w1.id]);
    expect(store.listForScope(A).map((w) => w.id).sort()).toEqual([w1.id, w2.id].sort());
  });

  it('changeRole rejects demoting owner directly', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    expect(() => store.changeRole(w.id as any, A, 'contributor')).toThrow(OwnerRemovalError);
  });

  it('changeRole rejects promoting non-owner to owner', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'contributor');
    expect(() => store.changeRole(w.id as any, B, 'owner')).toThrow(OwnerRemovalError);
  });

  it('changeRole works for non-owner role swaps', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'observer');
    const m = store.changeRole(w.id as any, B, 'contributor');
    expect(m.role).toBe('contributor');
  });

  it('transferOwnership swaps owner role atomically', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'contributor');
    const w2 = store.transferOwnership(w.id as any, B);
    expect(w2.ownerScopeId).toBe(B);
    expect(store.getMember(w.id as any, A).role).toBe('contributor');
    expect(store.getMember(w.id as any, B).role).toBe('owner');
  });

  it('transferOwnership requires target to be a member', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    expect(() => store.transferOwnership(w.id as any, C)).toThrow(MembershipNotFoundError);
  });

  it('delete cascades to memberships', () => {
    const w = store.create({ name: 'team', ownerScopeId: A });
    store.addMember(w.id as any, B, 'contributor');
    expect(store.delete(w.id as any)).toBe(true);
    expect(store.listForScope(A)).toHaveLength(0);
    expect(store.listForScope(B)).toHaveLength(0);
  });
});
