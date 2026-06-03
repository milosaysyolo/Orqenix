import { OrqenixError, type Brand } from '@orqenix/core';

export type ContentHash = Brand<string, 'ContentHash'>;
export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface DiffEntry {
  entryId: string;
  baseHash: ContentHash | null;
  contentHash: ContentHash;
  encoding: 'full' | 'zstd-delta';
  payload: Uint8Array;
  sizeBytes: number;
  createdAt: string;
}

export interface Snapshot {
  hash: ContentHash;
  bytes: Uint8Array;
}

export class DiffChainError extends OrqenixError {
  constructor(reason: string) { super(`diff chain error: ${reason}`, 'DIFF_CHAIN'); }
}
export class ContentHashMismatchError extends OrqenixError {
  constructor(expected: string, actual: string) {
    super(`content hash mismatch: expected ${expected.slice(0, 16)}..., got ${actual.slice(0, 16)}...`, 'HASH_MISMATCH');
  }
}
export class ZstdError extends OrqenixError {
  constructor(op: 'compress' | 'decompress', cause: unknown) {
    super(`zstd ${op} failed: ${(cause as Error)?.message ?? cause}`, 'ZSTD');
  }
}
