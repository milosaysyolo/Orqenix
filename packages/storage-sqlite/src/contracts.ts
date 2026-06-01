import { OrqenixError } from '@orqenix/core';

export interface SqliteConnectionOptions {
  path: string;
  readonly?: boolean;
  pragmas?: Record<string, string | number>;
  enableVec?: boolean;
}

export interface MigrationRecord {
  id: number;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  id: number;
  name: string;
  checksum: string;
  appliedAt: string;
}

export interface VectorRow {
  rowid: number;
  embedding: Float32Array;
}

export class SqliteOpenError extends OrqenixError {
  constructor(path: string, cause: unknown) {
    super(`failed to open SQLite at ${path}: ${(cause as Error)?.message ?? cause}`, 'SQLITE_OPEN');
  }
}
export class SqliteMigrationError extends OrqenixError {
  constructor(migrationId: number, reason: string) {
    super(`migration ${migrationId} failed: ${reason}`, 'SQLITE_MIGRATION');
  }
}
export class SqliteIntegrityError extends OrqenixError {
  constructor(reason: string) { super(`integrity violation: ${reason}`, 'SQLITE_INTEGRITY'); }
}
export class VecExtensionLoadError extends OrqenixError {
  constructor(cause: unknown) {
    super(`sqlite-vec extension load failed: ${(cause as Error)?.message ?? cause}`, 'VEC_LOAD');
  }
}
