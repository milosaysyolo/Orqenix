# @orqenix/file-watcher

Debounced cross-platform file watcher for the Orqenix reindex pipeline.

## Defaults

- Debounce: **150ms** (CR v7.1 default; tune higher on slow filesystems)
- Ignore: `.git/`, `node_modules/`, `dist/`, `.orqenix/identity.key`, gate reports
- Cross-platform paths normalized to forward slashes in `relPath`

## Quick start

```ts
import { FileWatcher } from '@orqenix/file-watcher';

const watcher = new FileWatcher({ rootDir: process.cwd(), debounceMs: 150 });
await watcher.start(async (batch) => {
  for (const e of batch) console.log(e.kind, e.relPath);
});
// later
await watcher.stop();
```

Charter gate: **G19 File Watcher**.
