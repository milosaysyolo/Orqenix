/**
 * Storage adapter pattern. Default impl: SQLite + sqlite-vec + LMDB.
 * See CHAPTER 4 (storage) of the spec.
 */

export interface KVValue {
  value: unknown;
  ttl?: number;
}

export interface VectorResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface Filter {
  [key: string]: unknown;
}

export interface Document {
  id?: string;
  [key: string]: unknown;
}

export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface StorageAdapter {
  // Lifecycle
  open(): Promise<void>;
  close(): Promise<void>;

  // KV
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  delete(key: string): Promise<void>;

  // Document
  insert(collection: string, doc: Document): Promise<string>;
  query(collection: string, filter: Filter, limit?: number): Promise<Document[]>;

  // Vector
  upsertVector(
    collection: string,
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<void>;
  searchVectors(collection: string, vector: number[], topK: number): Promise<VectorResult[]>;

  // Maintenance
  vacuum?(): Promise<void>;
  backup?(path: string): Promise<void>;
}
