import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteConnection, runMigrations, listApplied, SqliteMigrationError } from '../src';

describe('SqliteConnection + migrations', () => {
  let dir: string;
  let conn: SqliteConnection;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orqenix-sqlite-'));
    conn = new SqliteConnection({ path: join(dir, 'db.sqlite') });
  });
  afterEach(async () => { conn.close(); await rm(dir, { recursive: true, force: true }); });

  it('applies pragmas (WAL + foreign_keys)', () => {
    expect(conn.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(conn.db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('runMigrations applies in order', () => {
    const m1 = { id: 1, name: 'init', sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY) STRICT;', checksum: '' };
    const m2 = { id: 2, name: 'add_col', sql: 'ALTER TABLE a ADD COLUMN name TEXT;', checksum: '' };
    expect(runMigrations(conn, [m2, m1])).toBe(2);
    expect(listApplied(conn).map((m) => m.id)).toEqual([1, 2]);
  });

  it('is idempotent', () => {
    const m1 = { id: 1, name: 'init', sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY) STRICT;', checksum: '' };
    expect(runMigrations(conn, [m1])).toBe(1);
    expect(runMigrations(conn, [m1])).toBe(0);
  });

  it('detects checksum drift', () => {
    const m1 = { id: 1, name: 'init', sql: 'CREATE TABLE a (id INTEGER) STRICT;', checksum: '' };
    runMigrations(conn, [m1]);
    const drifted = { ...m1, sql: 'CREATE TABLE a (id INTEGER, x TEXT) STRICT;' };
    expect(() => runMigrations(conn, [drifted])).toThrow(SqliteMigrationError);
  });

  it('transaction rolls back on throw', () => {
    conn.exec('CREATE TABLE a (id INTEGER PRIMARY KEY) STRICT');
    expect(() =>
      conn.transaction(() => {
        conn.prepare('INSERT INTO a (id) VALUES (1)').run();
        throw new Error('rollback please');
      }),
    ).toThrow(/rollback please/);
    expect(conn.prepare('SELECT COUNT(*) as c FROM a').get()).toEqual({ c: 0 });
  });
});
