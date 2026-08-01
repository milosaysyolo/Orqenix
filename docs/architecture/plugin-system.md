# Plugin System

## Problem

Orqenix needs runtime extensibility without forking. Skills and MCP solve "give the
agent more capabilities" but cannot intercept lifecycle events (compress context, log
costs, enforce knowledge workflow). Plugins fill that gap.

## Constraints

- Plugins must work cross-platform (mac/linux/windows × x64/arm64).
- Plugins must not require Orqenix code changes to register.
- Plugin failures in `after` hooks must never crash the agent.
- Plugin order must be deterministic (priority-based, not load-order).
- Plugins must be opt-in per project.

## Design

### Hook contract

Twelve lifecycle hooks across five categories:

```
agent.task.before   agent.task.after
tool.execute.before tool.execute.after
memory.write        memory.query
knowledge.query     knowledge.update
session.start       session.end
llm.call.before     llm.call.after
```

### Execution semantics

| Hook type             | Behavior on throw | Chains output? |
| --------------------- | ----------------- | -------------- |
| `before` (5 hooks)    | aborts execution  | No             |
| `after` (2 hooks)     | logged, continues | No             |
| `transform` (5 hooks) | logged, continues | Yes (chained)  |

### Priority

Plugins declare `priority: number`. Higher = runs first. Default = 0.
Transform hooks see output of previous plugin as input.

### Discovery

```
1. Built-in (passed at boot from @orqenix/plugin-*)
2. .opencode/plugin/*.ts (project, file-based)
3. .orqenix/plugins/*.ts (project, file-based)
4. ~/.config/opencode/plugin/*.ts (global)
5. ~/.config/orqenix/plugins/*.ts (global)
6. npm packages from opencode.json "plugin": [...]
```

## Tradeoffs

- Chose **single process** (in-runtime plugins) over **subprocess isolation**.
  Reason: latency. Phase 8+ may add Pro sandbox for untrusted plugins.
- Chose **explicit priority** over **declarative dependency graph**.
  Reason: simplicity. Most plugins are independent.
- Chose **convention over manifest**. Plugin exports a function or object;
  no separate `plugin.json`. OpenCode-compatible.

## Open questions

- How to handle plugin version conflicts when two plugins register the same name?
  → Currently: throws. Phase 3 may add namespacing.
- How to expose Plugin SDK type definitions to community authors?
  → `@orqenix/sdk` package, Phase 3.
