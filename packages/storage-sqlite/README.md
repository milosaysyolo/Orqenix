# @orqenix/storage-sqlite

SQLite + sqlite-vec adapter for Orqenix KBs.

- WAL journal mode, foreign keys on, 5s busy timeout, NORMAL synchronous
- Migration runner with BLAKE3 checksum tracking (immutable history)
- Optional sqlite-vec extension for vector similarity search
- Pure adapter, no business logic

Charter gate: **G2** Diff-Only Storage (shared with storage-diff).
