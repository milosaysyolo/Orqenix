# @orqenix/provenance

Tamper-evident provenance chains for the Orqenix local-first mesh.

## What a chain looks like

```text
[0] sourceScopeId=A, sourceKind=local, producedAt=...
[1] sourceScopeId=B, sourceKind=mesh,  tokenJti=tok:..., parentChainHash=BLAKE3(tags[0])
[2] sourceScopeId=C, sourceKind=distilled,                parentChainHash=BLAKE3(tags[0..1])
chainHash = BLAKE3(canonicalJson(tags))
```

Any mutation of any tag invalidates downstream `parentChainHash` and the final `chainHash`.

## Source kinds

| Kind        | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `local`     | Originated in this scope                           |
| `mesh`      | Imported across a scope link (requires `tokenJti`) |
| `distilled` | Derived from another memory by the distiller       |
| `imported`  | One-shot import (no token, no link)                |

Charter gate: **G33 Provenance Chain Integrity**.
