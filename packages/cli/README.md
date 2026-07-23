# @orqenix/cli

The `orqenix` command-line surface for Phase 5 (CR v7.1 Ch.19).

## Install (workspace local)

```bash
pnpm --filter @orqenix/cli build
node packages/cli/dist/bin.js --help
```

## Commands

```text
orqenix v0.9.0

Commands:
  scope init --name <n>
  scope info
  link create --remote <id> [--direction outbound|inbound]
  link list [--status active|pending|revoked]
  link revoke --remote <id> [--direction outbound|inbound]
  workspace create --name <n>
  workspace list
  audit verify
  audit tail [--kind <kind>] [--limit 50]
  detach plan --kind unlink-remote --remote <id>
  detach plan --kind full-detach
  detach exec --kind <kind> [--remote <id>] --token <t> [--dry-run]
  migrate up
  migrate rollback --backup <path>
  migrate status
  version
```

## Available Commands

All commands listed in the Commands section above are available in the current version. Extended commands (knowledge, memory, recall, mesh, marketplace, gc, trash, history, security, config) are registered as stubs returning a helpful message and will ship in a future release.

## Environment

| Variable        | Default                            | Purpose                                     |
| --------------- | ---------------------------------- | ------------------------------------------- |
| `ORQENIX_ROOT`  | cwd                                | Scope root directory (contains `.orqenix/`) |
| `ORQENIX_DB`    | `$ORQENIX_ROOT/.orqenix/kb.sqlite` | SQLite database path                        |
| `ORQENIX_SCOPE` | placeholder                        | Local scope ID for the session              |

Charter gate: **G25 CLI Surface**.
