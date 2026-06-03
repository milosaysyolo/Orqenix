import type { SqliteConnection } from "./connection.js";

function toBlob(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function createVecTable(conn: SqliteConnection, name: string, dim: number): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`invalid table name: ${name}`);
  if (!Number.isInteger(dim) || dim <= 0 || dim > 4096) throw new Error(`invalid dim: ${dim}`);
  conn.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${name} USING vec0(embedding float[${dim}])`);
}

export function insertVec(
  conn: SqliteConnection,
  table: string,
  rowid: number,
  embedding: Float32Array,
): void {
  if (!Number.isInteger(rowid) || rowid < 1) throw new Error(`invalid rowid: ${rowid}`);
  conn
    .prepare(`INSERT INTO ${table}(rowid, embedding) VALUES(?, ?)`)
    .run(BigInt(rowid), toBlob(embedding));
}

export interface VecSearchHit {
  rowid: number;
  distance: number;
}

export function searchVec(
  conn: SqliteConnection,
  table: string,
  query: Float32Array,
  k: number,
): VecSearchHit[] {
  if (!Number.isInteger(k) || k <= 0 || k > 1000) throw new Error(`invalid k: ${k}`);
  const rows = conn
    .prepare<VecSearchHit>(
      `SELECT rowid, distance FROM ${table} WHERE embedding MATCH ? ORDER BY distance LIMIT ?`,
    )
    .all(toBlob(query), k) as VecSearchHit[];
  return rows;
}
