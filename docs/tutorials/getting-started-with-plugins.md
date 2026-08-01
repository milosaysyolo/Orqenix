# Getting Started with Orqenix Plugins

> Phase 8 onboarding tutorial. Build, install, and use plugins.

## 1. Install a reference plugin

Browse the Workbench Marketplace (`http://localhost:27420/marketplace`) or use
the CLI:

```bash
# Discover plugins
orqenix marketplace search "git commit"

# Install (reviews permissions first)
orqenix marketplace install @orqenix/plugin-git-commit-conventional
```

## 2. Invoke a skill from your agent

Once installed + activated, the skill is exposed via the Orqenix MCP server. Any
connected agent (Claude Code, Cursor, etc.) can call it:

```
orqenix_invoke_skill {
  skillName: "@orqenix/plugin-git-commit-conventional",
  input: { type: "feat", scope: "auth", description: "add OAuth login" }
}
→ { message: "feat(auth): add OAuth login" }
```

## 3. Build your own plugin

Start from a reference plugin. The 14 reference plugins each demonstrate one kind:

| Kind                      | Reference                                 |
| ------------------------- | ----------------------------------------- |
| skill                     | `@orqenix/plugin-git-commit-conventional` |
| knowledge-source          | `@orqenix/plugin-notion-source`           |
| embedding-model           | `@orqenix/plugin-bge-embedding`           |
| reranker                  | `@orqenix/plugin-bge-reranker`            |
| compression-strategy      | `@orqenix/plugin-semantic-compression`    |
| memory-injection-strategy | `@orqenix/plugin-windowed-injection`      |
| prompt-rewriter           | `@orqenix/plugin-qwen-rewriter`           |
| visualization             | `@orqenix/plugin-timeline-viz`            |
| code-analyzer             | `@orqenix/plugin-python-analyzer`         |
| kb-schema                 | `@orqenix/plugin-design-kb`               |
| mcp-server                | `@orqenix/plugin-example-mcp-server`      |
| agent                     | `@orqenix/plugin-example-agent`           |
| subagent                  | `@orqenix/plugin-test-runner-subagent`    |
| agent-binding             | `@orqenix/plugin-claude-code-binding-ref` |

```bash
# Create a new plugin from a template
orqenix marketplace new --kind skill --name @local/my-skill
```

Your `package.json` needs an `orqenixPlugin` field. See `@orqenix/csf` for the
full schema. The Workbench validates it on install.

## 4. Publish (Phase 8.2)

Once the plugin registry (`plugins.orqenix.dev`) ships in Phase 8.2, publish with:

```bash
orqenix marketplace publish @local/my-skill
```

## 5. Let Orqenix suggest skills (self-learning)

The observer watches your workflow. When it detects a recurring pattern, it
surfaces a candidate in `Workbench → Self-Learning → Candidates`. Promote it to
auto-generate a skill (it starts unverified; run verification before enabling).
