# @orqenix/reindex-incremental

Watermark-based incremental reindexing for Orqenix KBs. BLAKE3 content hash + path index, backed by `@orqenix/storage-sqlite`.

## Two modes

| Mode | Use case | Cost |
|------|----------|------|
| `scanFull()` | Cold start, periodic verification | O(repo) — walks all files |
| `applyEvents(events)` | Hot path from `@orqenix/file-watcher` | O(changes) — only touched files |

Both methods produce a `ReindexStats` with `filesScanned/Added/Updated/Removed/Unchanged` + `durationMs`.

Charter gate: **G20 Incremental Reindex**.
