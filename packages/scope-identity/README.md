# @orqenix/scope-identity

Ed25519-based scope identity for the Orqenix local-first mesh (CR v7.1, L4 Mesh+Identity).

## Quick start

```ts
import { initScope, loadScope } from "@orqenix/scope-identity";

const result = await initScope({
  rootDir: process.cwd(),
  name: "my-project",
  metadata: { description: "My first Orqenix scope", tags: ["demo"] },
});

console.log("Scope ID:", result.scopeId);
console.log("scope.yaml at:", result.scopeYamlPath);
console.log("identity.key at:", result.identityKeyPath);

// Later, load it back:
const { scopeYaml, keyPair } = await loadScope(process.cwd());
```

## Security model

| File                    | Visibility | Mode | In git?                 |
| ----------------------- | ---------- | ---- | ----------------------- |
| `.orqenix/scope.yaml`   | public     | 0644 | YES (committed)         |
| `.orqenix/identity.key` | secret     | 0600 | NEVER (auto-gitignored) |

`initScope` automatically appends `.orqenix/identity.key` to `.gitignore`. If you lose `identity.key`, your scope is permanently unrecoverable.

## Charter Gate

This package is gated by **G26: Scope Identity Integrity** (see `.orqenix/charter-gates/G26.yaml`).
