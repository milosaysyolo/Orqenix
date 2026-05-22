# dev-team

Lean software development team for code projects.

## Roster (4 always-loaded + 2 lazy)

| Agent                 | Mode     | Loaded    | Responsibility                   |
| --------------------- | -------- | --------- | -------------------------------- |
| `dev-team-lead`       | primary  | ✅ Always | Coordinator                      |
| `dev-team-builder`    | subagent | ✅ Always | Write, refactor, integrate       |
| `dev-team-inspector`  | subagent | ✅ Always | Test, review, verify             |
| `dev-team-navigator`  | subagent | ✅ Always | Search, read, plan, document     |
| `dev-team-debugger`   | subagent | ⏣ Lazy    | Systematic debugging (bug tasks) |
| `dev-team-researcher` | subagent | ⏣ Lazy    | External research                |

## Why 4+2 (not 10)

- 4 always-loaded × ~2k context overhead = ~8k baseline (vs 20k+ for 10 agents)
- Each agent has CLEAR ownership, no overlap
- Lazy agents only load when triggered by keywords

## Decision matrix

```

USER REQUEST              → AGENT FLOW
"Add feature X"           → navigator → builder → inspector
"Fix bug Y"               → navigator → debugger → builder → inspector
"Refactor Z"              → navigator → builder → inspector
"Write tests for X"       → navigator → inspector
"Document module"         → navigator → builder
"Compare frameworks"      → researcher → navigator
"What does this code do?" → navigator only

```

## Customizing this team

Edit source files in `.orqenix/teams/dev-team/agents/`.
Orqenix will sync your edits to `.opencode/agents/` automatically.
Do not edit `.opencode/agents/*.md` directly — those are auto-generated.

```bash
orqenix team edit dev-team builder
orqenix sync
```
