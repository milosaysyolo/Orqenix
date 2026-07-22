# @orqenix/cli

The `orqenix` command-line surface for Phase 5 (CR v7.1 Ch.19).

## Install (workspace local)

```bash
pnpm --filter @orqenix/cli build
node packages/cli/dist/bin.js --help
```

## Commands

```text
orqenix v0.5.0-phase-5

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

## Coming Soon

These commands from the v0.5.0-phase-5 design are planned for future releases:

- `init` — Initialize Orqenix in a repository — ⚠️ Coming in v0.10.0
- `doctor` — Verify environment and scope health — ⚠️ Coming in v0.10.0
- `knowledge index` — Index project docs, code, and decisions — ⚠️ Coming in v0.10.0
- `knowledge query <text>` — Query indexed knowledge — ⚠️ Coming in v0.10.0
- `knowledge status` — Show knowledge index status — ⚠️ Coming in v0.10.0
- `knowledge reindex` — Re-index project knowledge — ⚠️ Coming in v0.10.0
- `memory status` — Show memory tier status — ⚠️ Coming in v0.11.0
- `memory inspect <kb>` — Inspect a knowledge base — ⚠️ Coming in v0.11.0
- `memory show <kb> <id>` — Show a specific memory entry — ⚠️ Coming in v0.11.0
- `recall <ref_id>` — Recall a memory by reference — ⚠️ Coming in v0.11.0
- `recall search <query>` — Search memory — ⚠️ Coming in v0.11.0
- `scope verify` — Verify scope identity and links — ⚠️ Coming in v0.12.0
- `mesh status` — Show mesh topology — ⚠️ Coming in v0.12.0
- `mesh query <text>` — Query across linked scopes — ⚠️ Coming in v0.12.0
- `link add <path>` — Link another local scope by path — ⚠️ Coming in v0.12.0
- `mp search <text>` — Search the marketplace — ⚠️ Coming in v0.13.0
- `mp install <name>` — Install a plugin or skill — ⚠️ Coming in v0.13.0
- `mp list` — List installed plugins — ⚠️ Coming in v0.13.0
- `gc status` — Show garbage-collection status — ⚠️ Coming in v0.14.0
- `gc run` — Run garbage collection — ⚠️ Coming in v0.14.0
- `trash list` — List trashed artifacts — ⚠️ Coming in v0.14.0
- `history` — Show lifecycle history — ⚠️ Coming in v0.14.0
- `security tokens list` — List capability tokens — ⚠️ Coming in v0.15.0
- `security audit` — Show security audit trail — ⚠️ Coming in v0.15.0
- `config` — View or edit configuration — ⚠️ Coming in v0.16.0

## Environment

| Variable        | Default                            | Purpose                                     |
| --------------- | ---------------------------------- | ------------------------------------------- |
| `ORQENIX_ROOT`  | cwd                                | Scope root directory (contains `.orqenix/`) |
| `ORQENIX_DB`    | `$ORQENIX_ROOT/.orqenix/kb.sqlite` | SQLite database path                        |
| `ORQENIX_SCOPE` | placeholder                        | Local scope ID for the session              |

Charter gate: **G25 CLI Surface**.
