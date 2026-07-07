# @orqenix/mcp-server

> Apache-2.0 Orqenix MCP Server. The substrate that AI coding agents reach into.
> Phase 8 Foundation (D8.α.7). Charter gate G63 (14 sub-criteria).

## Mission

Exposes Orqenix memory + skills + mesh as Model Context Protocol (MCP)
tools/resources/prompts. Any MCP-compatible client (Claude Code, Cursor,
Codex, OpenCode, Cline, Aider, Continue) connects and gains:

- **Memory**: query/write across the 3-level hierarchy
- **Skills**: invoke any installed CSF skill
- **Mesh**: link scopes, verify audit chain
- **Sessions**: report session lifecycle for self-learning

Per CR v8.0 Chapter 9 + ADR-E-005 + INV-19 (MCP-first interoperability).

## 10 Tools

| Tool                            | Description                      |
| ------------------------------- | -------------------------------- |
| `orqenix_recall_memory`         | Query memory across hierarchy    |
| `orqenix_record_decision`       | Record an architectural decision |
| `orqenix_record_lesson`         | Record a lesson learned          |
| `orqenix_query_codekb`          | Query the CodeKB                 |
| `orqenix_invoke_skill`          | Invoke a registered skill        |
| `orqenix_link_scope`            | Link two scopes                  |
| `orqenix_verify_audit_chain`    | Verify audit chain integrity     |
| `orqenix_promote_to_branch`     | Promote session memory to branch |
| `orqenix_report_session_start`  | Report new session               |
| `orqenix_report_session_resume` | Report session resumption        |

## 9 Resources

| URI                             | Description                         |
| ------------------------------- | ----------------------------------- |
| `orqenix://identity/scope`      | Scope identity (Ed25519 + scope_id) |
| `orqenix://memory/matrix`       | Memory matrix snapshot              |
| `orqenix://mesh/peers`          | Linked peers                        |
| `orqenix://audit/log`           | Audit log (paginated)               |
| `orqenix://config/project`      | Project config                      |
| `orqenix://config/branch/<id>`  | Branch config                       |
| `orqenix://config/session/<id>` | Session config                      |
| `orqenix://skills/registered`   | Installed skills                    |
| `orqenix://plugins/active`      | Active plugins                      |

## 6 Prompts

`orqenix_decision_template`, `orqenix_lesson_template`, `orqenix_review_template`,
`orqenix_summarize_session`, `orqenix_pre_commit`, `orqenix_post_test_failure`.

## 3 Transports

- `stdio` (default for Claude Code + CLI agents)
- `http` (web-based agents)
- `websocket` (real-time agents)

## Usage

```bash
# Start MCP server on stdio (default)
orqenix-mcp --project ./.orqenix --transport stdio

# Start on HTTP
orqenix-mcp --project ./.orqenix --transport http --port 27420
```

```ts
import { OrqenixMcpServer } from "@orqenix/mcp-server";
import { MemoryEngine } from "@orqenix/memory-engine";

const engine = await MemoryEngine.open("./.orqenix/memory.db", { projectId: "..." });
const server = new OrqenixMcpServer({ engine, transport: "stdio" });
await server.start();
```

## Authentication

Each MCP client presents a capability token (extends Phase 6 capability model).
Tokens are issued from Workbench, scoped per agent platform, and revocable.

## License

Apache-2.0 , see ./LICENSE
