# @orqenix/audit-log

Tamper-evident append-only audit log for Orqenix scope actions (CR v7.1 Ch.17).

## What it records

| Category | Events |
|----------|--------|
| Identity + tokens | `scope_initialized`, `token_issued`, `token_revoked` |
| Links | `link_created`, `link_activated`, `link_revoked` |
| Workspaces | `workspace_created`, `workspace_deleted`, `member_added`, `member_removed`, `ownership_transferred` |
| KB + mesh | `kb_write`, `kb_delete`, `mesh_query_run` |
| Distillation | `memory_distilled` |
| Detach | `scope_detached` |

## Tamper evidence

Each entry: `contentHash = BLAKE3(canonicalJson({ scope, actor, kind, payload, prevHash, createdAt }))`.
Each entry's `prevHash` = previous entry's `contentHash` for the same scope.

Any mutation of any row breaks `verifyChain()` deterministically.

Charter gate: **G18 Audit Log Tamper Detection**.
