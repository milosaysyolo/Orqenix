# Getting Started with Orqenix

This guide takes you from zero to your first mesh-linked scope in about
5 minutes.

## Prerequisites

- Node.js 20 or later (`node --version`)
- pnpm 9 or later (`pnpm --version`), or use `npx`
- A Git repository (Orqenix is scoped per repo)

## 1. Install the CLI

```bash
pnpm add -D @orqenix/cli
# or, for a global install
pnpm add -g @orqenix/cli
```

Verify:

```bash
orqenix --version
```

## 2. Initialize a scope

From the root of your Git repository:

```bash
orqenix scope init
```

This creates a `.orqenix/` folder containing:

- `scope.yaml`, the scope manifest with the generated Ed25519 keypair
- `kb/`, the local knowledge base (SQLite by default)
- `tokens/`, capability tokens (gitignored by default)
- `links/`, cross-scope link records

Your scope ID is a BLAKE3 hash of `git remote + creation timestamp + public key`.
You can read it with:

```bash
orqenix scope id
```

## 3. Link another scope

If you have a second project you want to share knowledge with:

```bash
# In project A
orqenix link offer --to-scope <scope-id-of-B> --caps read:kb-code,read:kb-chat

# In project B
orqenix link accept --from-scope <scope-id-of-A> --token <token-from-A>
```

Now project B can query project A's knowledge base, scoped to the capabilities
that were granted.

## 4. Run your first cross-scope query

```bash
orqenix recall "how do we handle auth tokens" --include-linked
```

You will see results from the local scope and any linked scopes whose
capability tokens permit `read:kb-chat` or `read:kb-code`.

## 5. Next steps

- Read the [Architecture overview](./architecture.md) to understand the
  6-layer model
- Configure a [polyglot backend](./architecture.md#polyglot-storage)
  (Pro only) for projects > 100K files
- Wire Orqenix into your AI coding agent via the
  [Memory MCP server](./mcp.md)
- Browse the [FAQ](./faq.md)

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Error: native module not found (better-sqlite3)` | Node ABI mismatch | `pnpm rebuild better-sqlite3` |
| `Capability denied: read:kb-chat` | Link token missing the cap | Re-issue the link with `--caps read:kb-chat` |
| `Scope already initialized` | `.orqenix/` exists | Use `orqenix scope info` to inspect |

If you hit something not listed here, please
[open a Q&A discussion](https://github.com/milosaysyolo/Orqenix/discussions/categories/q-a).
