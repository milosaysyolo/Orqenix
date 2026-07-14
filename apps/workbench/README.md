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

## Production (local-first)

Runs as a single Node process serving the built app. The engine writes to a
local SQLite DB — no external services required.

```bash
# 1. Build the workspace packages the Workbench imports
pnpm -r --filter "@orqenix/*" run build

# 2. Configure (see .env.example)
cp .env.example .env
#   ORQENIX_DB        where the engine stores data     (default .orqenix/memory.db)
#   ORQENIX_STRICT    1 = fail loud if the engine can't open (prod); 0 = demo fallback
#   PORT / HOSTNAME   listen address                  (default 27420 / 127.0.0.1)

# 3. Build + start
pnpm --filter @orqenix/workbench build
pnpm --filter @orqenix/workbench start
# → http://127.0.0.1:27420
```

Subsystems report their status via `GET /api/health` (`engines` map:
`real` = backed by the live engine, `demo` = in-memory fallback). Every API
route falls back to the demo store if the engine is unavailable, so the UI
stays usable either way.

Network (npm/github) plugin install is intentionally **not** wired — the
marketplace is local-first (installs from the bundled CSF catalog).

## License

Apache-2.0.