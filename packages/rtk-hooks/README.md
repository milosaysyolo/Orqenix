# @orqenix/rtk-hooks

Read-Through Kernel shell hooks: capture stdout/stderr of shell commands into ChatKB so AI agents can see what was executed.

## Safety defaults (CR v7.1 Ch.16)

- Blocked commands: `rm`, `rmdir`, `shutdown`, `reboot`, `mkfs`, `dd`
- Output cap: 256 KB stdout, 256 KB stderr (truncated, never silently dropped)
- Timeout: 60s
- Redaction: API keys, Bearer tokens, `password=...` patterns scrubbed before storage

## Use with plugin-compress-input

```ts
import { RtkRunner, createRtkCompressInputExtension } from '@orqenix/rtk-hooks';

const runner = new RtkRunner({
  scopeId: MY_SCOPE,
  config: { timeoutMs: 30_000 },
});

const ext = createRtkCompressInputExtension({ runner });
const { injected, result } = await ext({ cmd: 'ls', args: ['-la'] });
// injected -> can be passed as the next user message to the LLM
```

Charter gate: **G21 RTK Hooks Integration**.
