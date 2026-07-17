// SPDX-License-Identifier: Apache-2.0
import Database, { type Database as DB, type Statement } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import {
  SqliteOpenError,
  VecExtensionLoadError,
  type SqliteConnectionOptions,
} from "./contracts.js";

const DEFAULT_PRAGMAS: Record<string, string | number> = {
  journal_mode: "WAL",
  foreign_keys: "ON",
  busy_timeout: 5000,
  synchronous: "NORMAL",
};

export class SqliteConnection {
  readonly db: DB;
  private closed = false;

  constructor(public readonly opts: SqliteConnectionOptions) {
    try {
      this.db = new Database(opts.path, { readonly: !!opts.readonly });
    } catch (e) {
      throw new SqliteOpenError(opts.path, e);
    }
    const pragmas = { ...DEFAULT_PRAGMAS, ...(opts.pragmas ?? {}) };
    for (const [k, v] of Object.entries(pragmas)) {
      this.db.pragma(`${k} = ${v}`);
    }
    if (opts.enableVec) {
      try {
        sqliteVec.load(this.db);
      } catch (e) {
        throw new VecExtensionLoadError(e);
      }
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare<T = unknown>(sql: string): Statement<unknown[], T> {
    return this.db.prepare(sql) as Statement<unknown[], T>;
  }

  transaction<T>(fn: () => T): T {
    const wrapped = this.db.transaction(fn);
    return wrapped();
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }
}
