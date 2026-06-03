# @orqenix/storage-diff

Content-addressed, diff-only storage primitives.

- BLAKE3 content hashing (64-char hex, 32-byte digest)
- zstd-compressed Myers delta encoding between snapshots
- Diff-chain reconstruction with integrity verification
- Snapshot policy heuristic (`shouldSnapshot`: every N entries or maxBytes cumulative)

Charter gate: **G2** Diff-Only Storage.
