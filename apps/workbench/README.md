# Orqenix Workbench

Local mission control for AI engineering — memory, agents, marketplace, and
self-learning — wired to your project's `.orqenix/memory.db`. Warm editorial UI
matching the Orqenix landing page. Runs at `http://127.0.0.1:27420`.

## Run

```bash
# 1. Build the workspace packages the Workbench imports
pnpm -r --filter "@orqenix/*" run build

# 2. Point at a project (optional; defaults to cwd)
export ORQENIX_PROJECT=/path/to/your/repo   # contains .orqenix/
export ORQENIX_DEV=1                          # bootstrap base tables in dev

# 3. Start
pnpm --filter @orqenix/workbench dev
# → http://127.0.0.1:27420
```

## Architecture

- **`lib/runtime.ts`** — single `getRuntime()` opens `memory.db` once and wires
  every shipped service (memory-engine, plugin-core, marketplace-core,
  normalization, self-learning, mcp-server, settings-registry, federation).
- **`lib/event-bus.ts` + `/api/stream`** — SSE live event bus. Powers every
  "Live" panel.
- **API routes** under `app/api/*` — every screen reads/writes real data, no stubs.

## Screens

| Group | Screens |
|---|---|
| Workspace | Dashboard (live context pipeline), Memory Explorer (graph + linking), Branches (deep-copy), Learning Hub |
| Agents | Orchestrator (team canvas), Runner (live network), Sessions, Subagents, MCP Server, Bindings, Network |
| Ecosystem | Marketplace, Plugins, Skills, Mesh |
| Operations | Audit (BLAKE3 chain), Observability |
| Config | Settings (phase-locked, hierarchy override) |

## Live loop

`Orchestrator → Run Team → /api/agents/run` creates real sessions and emits
events → SSE → the Dashboard pipeline, Agent Runner network, and Sessions all
animate in real time. `/api/query/demo` runs a real `engine.query()` and streams
the recall→distill→sign→rerank→inject→send stages.

## Theme

Dual light/dark, warm editorial tokens from the landing page. Toggle in the top bar.

## License

Apache-2.0.