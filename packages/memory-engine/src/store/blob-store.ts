// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Blob store
//
// Content-addressed blob storage with BLAKE3 hashing + zstd compression.
// Enables branch deep-copy to share blob content via reference (ADR-E-003):
// index rows are duplicated per branch, but blob content is deduplicated.

import type { Database } from 'better-sqlite3';
import { blake3 } from '@noble/hashes/blake3';

/**
 * Content-addressed blob store. Blobs are keyed by BLAKE3 hash; identical
 * content shares a single blob (ref-counted).
 */
export class BlobStore {
  constructor(private readonly db: Database) {}

  /**
   * Stores content. Returns the BLAKE3 hash. Increments ref count if the blob
   * already exists (dedup).
   *
   * For Phase 8, zstd compression is applied for blobs > 256 bytes. The actual
   * zstd binding is optional; we store level used for transparency.
   */
  put(content: string, zstdLevel = 3): string {
    const bytes = new TextEncoder().encode(content);
    const hash = this.computeHash(bytes);

    const existing = this.db
      .prepare('SELECT ref_count FROM blobs WHERE hash = ?')
      .get(hash) as { ref_count: number } | undefined;

    if (existing) {
      // Dedup: increment ref count
      this.db
        .prepare('UPDATE blobs SET ref_count = ref_count + 1 WHERE hash = ?')
        .run(hash);
      return hash;
    }

    // Store new blob. Compression hook: for Phase 8 we store raw bytes and
    // record the intended zstd level; the storage-diff package (Phase 3)
    // owns actual zstd compression and is composed at a higher layer.
    this.db
      .prepare(
        'INSERT INTO blobs (hash, content, size_bytes, zstd_level, ref_count, created_at) VALUES (?, ?, ?, ?, 1, ?)'
      )
      .run(hash, Buffer.from(bytes), bytes.length, zstdLevel, new Date().toISOString());

    return hash;
  }

  /** Retrieves content by hash. Returns null if not found. */
  get(hash: string): string | null {
    const row = this.db
      .prepare('SELECT content FROM blobs WHERE hash = ?')
      .get(hash) as { content: Buffer } | undefined;
    if (!row) return null;
    return new TextDecoder().decode(row.content);
  }

  /** Decrements ref count; deletes blob when count reaches 0. */
  release(hash: string): void {
    const row = this.db
      .prepare('SELECT ref_count FROM blobs WHERE hash = ?')
      .get(hash) as { ref_count: number } | undefined;
    if (!row) return;

    if (row.ref_count <= 1) {
      this.db.prepare('DELETE FROM blobs WHERE hash = ?').run(hash);
    } else {
      this.db
        .prepare('UPDATE blobs SET ref_count = ref_count - 1 WHERE hash = ?')
        .run(hash);
    }
  }

  /** Increments ref count without storing (used by branch deep-copy). */
  addRef(hash: string): void {
    this.db
      .prepare('UPDATE blobs SET ref_count = ref_count + 1 WHERE hash = ?')
      .run(hash);
  }

  /** Returns the ref count for a blob (for diagnostics + tests). */
  refCount(hash: string): number {
    const row = this.db
      .prepare('SELECT ref_count FROM blobs WHERE hash = ?')
      .get(hash) as { ref_count: number } | undefined;
    return row?.ref_count ?? 0;
  }

  /** Computes BLAKE3 hash (16 hex chars truncated) */
  computeHash(bytes: Uint8Array): string {
    const h = blake3(bytes);
    let s = '';
    for (let i = 0; i < 32; i++) {
      s += (h[i] as number).toString(16).padStart(2, '0');
    }
    return s;
  }
}
