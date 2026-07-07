# @orqenix/plugin-core

> Apache-2.0 plugin architecture foundation for Orqenix.
> Phase 8 Foundation (D8.α.4), Charter gate G62 (22 sub-criteria).

## Mission

Provides the foundational plugin architecture for Orqenix:

- **14 plugin kinds** locked per CR v8.0 ADR-E-006
- **5-phase lifecycle**: install → configure → activate → deactivate → uninstall
- **Separate-process sandbox** by default per ADR-E-004
- **Canonical Skill Format (CSF)** manifest with provenance tracking
- **Capability-based permissions** extending Phase 6 capability tokens
- **Conformance suite** for testing plugin implementations

## 14 Plugin Kinds

### Knowledge Ecosystem (9 kinds)

| Kind                        | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `knowledge-source`          | Connect external knowledge bases (Notion, Linear, Jira) |
| `embedding-model`           | Provide embedding generation (BGE, OpenAI, Voyage)      |
| `reranker`                  | Rerank search results                                   |
| `compression-strategy`      | Alternative memory compression                          |
| `memory-injection-strategy` | Alternative context injection (extends Phase 2 A-E)     |
| `prompt-rewriter`           | Rewrite prompts for better retrieval                    |
| `visualization`             | Custom Workbench visualizations                         |
| `code-analyzer`             | Parse + analyze code in specific languages              |
| `kb-schema`                 | Extend default 4 KBs with custom schemas                |

### Agent Ecosystem (5 kinds)

| Kind            | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `mcp-server`    | Expose MCP Server endpoints (tools + resources + prompts)      |
| `agent`         | Autonomous orchestrator (coordinates skills + subagents)       |
| `subagent`      | Specialized helper (no matrix per ADR-E-002)                   |
| `skill`         | Atomic capability (MCP-tool-compatible)                        |
| `agent-binding` | Bridge to external agent platforms (Claude Code, Cursor, etc.) |

## Sandbox Model

Per ADR-E-004 + Anti-pattern 29:

- **Default**: Separate Node.js process per plugin
- **Opt-in**: WebAssembly (strong isolation, language portability)
- **Forbidden**: In-process loading of installed plugins

A crashed plugin must NOT affect Workbench or other plugins (INV-14).

## Plugin Lifecycle

```
┌─────────────┐
│   Install   │  Plugin package downloaded + manifest validated + registered
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Configure  │  User reviews + adjusts settings via Workbench
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Activate   │  Plugin sandbox spawned + ready to serve requests
└──────┬──────┘
       │
       │ ◄── Hot-reload on settings change (when supported)
       │
       ▼
┌─────────────┐
│ Deactivate  │  Plugin sandbox shut down + state preserved
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Uninstall  │  Plugin removed + cleanup hooks run + audit retained
└─────────────┘
```

## Plugin Manifest Format

Plugins declare integration via `orqenixPlugin` field in `package.json`:

```json
{
  "name": "@example/git-commit-conventional",
  "version": "1.2.0",
  "license": "Apache-2.0",
  "main": "./dist/plugin.js",
  "orqenixPlugin": {
    "manifestVersion": "1.0",
    "kind": "skill",
    "compatibility": {
      "orqenix": ">=0.8.0",
      "mcp": ">=0.5.0"
    },
    "permissions": ["scope.read", "git.write"],
    "external_agent_compat": ["claude-code", "cursor", "codex"],
    "tool": {
      "name": "git_commit_conventional",
      "description": "Creates Conventional Commits messages",
      "inputSchema": {
        /* JSON Schema */
      }
    },
    "sandboxMode": "separate_process"
  }
}
```

See `@orqenix/csf` for the complete schema.

## Usage

```ts
import {
  PluginRegistry,
  PluginLoader,
  SandboxManager,
  validateManifest,
} from "@orqenix/plugin-core";

// Validate manifest
const result = validateManifest(packageJson);
if (!result.success) {
  console.error(result.errors);
}

// Load + register
const loader = new PluginLoader();
const plugin = await loader.load("./node_modules/@example/git-commit-conventional");

const registry = new PluginRegistry();
await registry.register(plugin);

// Activate (spawns sandbox)
const sandbox = new SandboxManager();
const handle = await sandbox.activate(plugin);

// Invoke
const result = await handle.invoke("git_commit_conventional", {
  type: "feat",
  description: "add cross-project federation",
});
```

## What this package does NOT do

- ❌ Marketplace UI (D8.β ships @orqenix/marketplace-core + marketplace-ui)
- ❌ Plugin registry hosting (D8.2 ships plugins.orqenix.dev)
- ❌ Plugin signing / Sigstore (D8.2 ships @orqenix/plugin-signing)
- ❌ Normalization Engine (D8.β ships @orqenix/normalization-engine)
- ❌ Actual plugin implementations (D8.δ ships 14 reference plugins)

## License

Apache-2.0 , see ./LICENSE
