# MCP Integration

## Problem

Orqenix must work with any editor that speaks MCP (Claude Code, Codex, Cursor,
Antigravity, future ones) and must consume any MCP server (GitHub, Filesystem,
Slack, etc.). Single protocol, two directions.

## Constraints

- MCP SDK is official and stable (`@modelcontextprotocol/sdk`).
- Editors invoke us via stdio in most cases; cloud editors over SSE.
- We never assume which transport. Adapter pattern required.

## Design

### Two packages

- `@orqenix/mcp-client` — connect to N external MCP servers; aggregate tools.
- `@orqenix/mcp-server` — expose Orqenix tools to any MCP client.

### Server tools (Phase 2 set)

- `orqenix_scope_current` — return scope
- `orqenix_session_id` — return session
- `orqenix_team_list` — list teams

Phase 4 will add `orqenix_knowledge_query`, `orqenix_memory_save`, etc.

### Client manager

`McpClientManager` keeps connections alive and aggregates tools across servers.
Tools are namespaced by server name to avoid collisions.

## Tradeoffs

- Chose to **delay full tool execution proxy** to Phase 3. Phase 2 only
  surfaces tools but the agent doesn't invoke them yet (no LLM dispatch).
- Chose **lazy server connection** over connect-all-on-boot. Saves resources
  when user only uses one server.

## Open questions

- Will MCP gain a streaming response spec? If yes, our transport layer needs update.
- Should we expose `orqenix_run_team` as a tool? Could enable cross-tool delegation.
