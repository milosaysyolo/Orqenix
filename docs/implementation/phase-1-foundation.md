# Phase 1 — Foundation Implementation Guide

> Audience: AI coding agent (OpenCode primary).  
> Goal: ship a working Orqenix monorepo with scope, config, storage adapter pattern,
> sync engine v1, and the built-in `dev-team` bundle.

## 0. Read before coding

Read in this order:

1. This document end-to-end
2. `/docs/architecture/README.md`
3. The Consolidated Requirements v5.0 (in conversation history)
4. The current state of `packages/core/src` to find existing types

You **must not** invent file paths, package names, or formats. They are all listed here.

## 1. Prerequisites

```bash
node --version    # must be >= 20.0.0
pnpm --version    # must be >= 9.0.0
git --version
```

Install:

```bash
pnpm install
```

## 2. Acceptance criteria

When Phase 1 is complete:

- [ ] `pnpm verify-phase-1` exits 0 with "✓ All checks passed"
- [ ] `pnpm build` produces dist/ for `@orqenix/core` and `orqenix` CLI
- [ ] `pnpm test` runs all vitest suites green
- [ ] `pnpm typecheck` is clean across all packages
- [ ] `orqenix init` initializes a project: creates `.orqenix/`, `.opencode/`, `opencode.json`
- [ ] `orqenix doctor` detects git info, generates scope ID, prints session ID
- [ ] `orqenix sync` compiles `packages/teams-built-in/dev-team` → `.opencode/agents/dev-team-*.md`
- [ ] `orqenix config show` prints the merged config respecting precedence
- [ ] `orqenix scope current` prints a valid ScopeId JSON
- [ ] All 6 dev-team agent files exist and contain valid frontmatter
- [ ] Sync state file `.orqenix/sync/agents.json` records all 6 agents

## 3. Out of scope (do not build)

- Web UI (Phase 6)
- MCP server / client (Phase 2)
- Plugin system (Phase 2 polish, basic hooks Phase 3)
- compress-input/output/context plugins (Phase 3)
- DocsKB / CodeKB / DecisionKB (Phase 4)
- Cluster / Network (Phase 5)
- Multi-arch binaries (Phase 7)
- Postgres adapter (Phase 8+)
- sqlite-vec wiring (Phase 4) — leave stubs in place
- Embedding model bootstrap (Phase 1.5 — separate task)

If you find yourself building any of the above, **stop** and re-read this guide.

## 4. Tasks (in order)

### Task 1.1 — Apply the scaffold

Copy every file from "Delivery 1" (this conversation) into the repo at the
listed paths. The set is:

- Root: `.gitignore`, `.editorconfig`, `.nvmrc`, `.prettierrc`, `.npmrc`,
  `LICENSE`, `README.md`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
  `tsconfig.base.json`
- `scripts/postinstall.ts`, `scripts/verify-phase-1.ts`
- `docs/architecture/README.md`, `docs/implementation/phase-1-foundation.md`
- `packages/core/**` (all files)
- `packages/cli/**` (all files)
- `packages/teams-built-in/**` (all files)

Run:

```bash
pnpm install
pnpm build
pnpm test
```

If everything passes, proceed.

### Task 1.2 — Verify scope/id-generator

The implementation is already provided in `packages/core/src/scope/id-generator.ts`.

You must:

- [ ] Confirm `packages/core/test/scope.test.ts` passes
- [ ] Add one more test: scopes with identical descriptors but different sessions produce different hashes
- [ ] Add one more test: scope `full` string contains exactly 5 segments separated by `/`

### Task 1.3 — Verify session detection chain

The implementation is already provided in `packages/core/src/scope/session-detect.ts`.

Add `packages/core/test/session-detect.test.ts`:

- [ ] When all env vars are unset and no editor files exist, `detectSession()` returns a value matching `/^s-\d{14}-[a-f0-9]{6}$/`
- [ ] When `OPENCODE_SESSION_ID=abc` is set, `detectSession()` returns `"oc-abc"`
- [ ] When `CLAUDE_SESSION_ID=xyz` is set and OpenCode env is unset, returns `"cc-xyz"`

Use vitest's `vi.stubEnv`.

### Task 1.4 — Verify git detection

The implementation is already provided in `packages/core/src/scope/git-info.ts`.

Add `packages/core/test/git-info.test.ts`:

- [ ] When run outside a git repo (use `mkdtemp`), `detectGitInfo()` returns `null`
- [ ] When run inside a git repo (init one), `detectGitInfo()` returns `repoRoot`, `branch`, `worktreePath`

### Task 1.5 — Config loader merge semantics

The implementation is already provided in `packages/core/src/config/loader.ts`.

Add `packages/core/test/config-loader.test.ts`:

- [ ] Loading without any config files returns `DEFAULT_CONFIG`
- [ ] Project config overrides global on conflicting keys
- [ ] Arrays are replaced, not concatenated
- [ ] Unknown top-level keys are preserved (forward-compat)
- [ ] Invalid JSONC logs a warning but does not throw

### Task 1.6 — Skill compiler (complete the stub)

The file `packages/core/src/sync/skill-compiler.ts` currently has only
`readSkillSource`. Implement `compileSkillForOpenCode`:

```typescript
export function compileSkillForOpenCode(
  skill: SkillFile,
  meta: { teamName: string; teamVersion: string },
): string {
  // 1. Add the same AUTO-GENERATED warning marker as agents
  // 2. Render OpenCode-only frontmatter fields: name, description, license?,
  //    compatibility?, metadata? (string-to-string map only — OpenCode rule)
  // 3. If skill.frontmatter contains non-string metadata values, coerce to string
  // 4. Output: marker + "---\n" + yaml + "\n---\n\n" + body
}
```

Add `packages/core/test/skill-compiler.test.ts` with at least 2 cases.

### Task 1.7 — `orqenix team` commands

The CLI stubs are in `packages/cli/src/commands/team.ts`. Replace stubs with
real implementations:

#### `orqenix team list`

- Walk `.orqenix/teams/*/team.json` and `~/.config/orqenix/teams/*/team.json`
- For each, print: name, version, description, lead, agent count, sync target
- Format: a 5-column table with kleur colors

#### `orqenix team create <name>`

- Args: positional `<name>` (validate against `^[a-z0-9]+(-[a-z0-9]+)*$`)
- Flags: `--description`, `--lead-role`, `--core` (comma-separated), `--optional` (comma-separated), `--skills`, `--mcp`
- Behavior:
  - Refuse if `<name>` already exists locally
  - Create `.orqenix/teams/<name>/team.json` (use the dev-team manifest as the schema source of truth)
  - Create `.orqenix/teams/<name>/agents/{lead,...}.md` with minimal frontmatter
  - Create `.orqenix/teams/<name>/README.md` with a stub
  - Run sync at the end
- Output: success summary + next-step hints

#### `orqenix team show <name>`

- Print manifest pretty-printed
- Plus sync state (in-sync / drift / unsynced) by comparing source hashes to recorded outputHash

#### `orqenix team install <source>`

- Sources to support in Phase 1:
  - Local tarball path: `./team.tgz` (use `node:zlib` + `tar`)
  - Local directory path
  - GitHub shorthand `github:user/repo` (use isomorphic-git clone into a tmp dir, then copy)
- Reject HTTP URLs and npm scopes in Phase 1 (defer to Phase 2)
- Validate the manifest before copying into `.orqenix/teams/<name>`
- Run sync at the end

Add unit tests where feasible; integration tests use temp directories.

### Task 1.8 — `orqenix sync` polish

The base implementation is in `packages/core/src/sync/engine.ts`. Add:

- [ ] `--dry-run` mode: compute writes but do not touch disk; report what would change
- [ ] `--verify` mode: read each output, hash it, compare against state; report drift only
- [ ] `--watch` mode (daemon-style): use `chokidar` to watch source files; on change, sync only the affected team; debounce 500ms
- [ ] Handle `conflictResolution: "prompt"`: when conflict detected, print a unified diff (use the `diff` npm package) and ask `[k]eep / [o]verwrite / [s]kip`

### Task 1.9 — `orqenix doctor` enhancements

The base implementation is in `packages/cli/src/commands/doctor.ts`. Extend it:

- [ ] Check pnpm version >= 9
- [ ] Check git installed
- [ ] Check write permission on `~/.config/orqenix` and `~/.local/share/orqenix`
- [ ] Check port 39397 is free (skip with `--no-port-check`)
- [ ] If `.orqenix/` exists in cwd, run a sync `--verify` and report drift
- [ ] Final summary: `✓ N checks passed, ✗ M failed, ⚠ K warnings`

### Task 1.10 — Storage adapter smoke test

Add `packages/core/test/sqlite-adapter.test.ts`:

- [ ] Open in a tmp file, set/get KV, delete KV, expire TTL
- [ ] Insert and query a document
- [ ] Close cleanly
- [ ] Reopen the same file and read existing data (persistence)

The vector methods throw in Phase 1 by design. Cover that with one test that
asserts the error message includes "Phase 4".

### Task 1.11 — `verify-phase-1` runs clean

Run:

```bash
pnpm verify-phase-1
```

Required output:

```
  • monorepo: pnpm workspace exists ... ✓
  • monorepo: turbo config exists ... ✓
  • packages/core exists ... ✓
  • packages/cli exists ... ✓
  • packages/teams-built-in/dev-team has 6 agents ... ✓
  • build succeeds ... ✓
  • tests pass ... ✓
  • typecheck passes ... ✓

✓ All checks passed
```

If any check fails, fix before claiming Phase 1 done.

## 5. Done definition (per task)

A task is done when:

- [ ] Files match the spec exactly (paths, names, formats)
- [ ] All listed tests pass
- [ ] `pnpm typecheck` is clean
- [ ] No `TODO`, `FIXME`, or `XXX` left in shipped code (use `// stub:` for
      intentionally deferred work with a Phase reference)
- [ ] Public APIs have JSDoc comments with at least @param and @returns
- [ ] Behavior matches the relevant chapter of Consolidated Requirements v5.0

## 6. Common pitfalls

- **Path handling on Windows** — always use `node:path` functions, never raw `/` or `\\`. Test on Windows if possible.
- **Frontmatter rendering** — OpenCode requires fields at the top level, not under `orqenix:`. Do not nest OpenCode fields by accident.
- **Hash stability** — `JSON.stringify` is not deterministic in field order. The `id-generator.ts` works because the input object has a fixed shape; if you change the shape, sort keys before hashing.
- **gray-matter YAML output** — do NOT use `matter.stringify()` to emit YAML; we have our own renderer that preserves the `orqenix:` namespace cleanly.
- **better-sqlite3 native build** — if it fails on a CI runner, set `npm_config_build_from_source=true` or use the prebuilt binary path; see better-sqlite3 README.
- **isomorphic-git** — slower than spawning `git`, but works on Windows without a git CLI. Stick with isomorphic-git for `team install github:...`.
- **Avoid OpenCode/Claude/Cursor incompatibilities** — every agent or skill file Orqenix writes to `.opencode/` must validate against the OpenCode schema. If a field is unknown to OpenCode, it must be under `orqenix:`.

## 7. After Phase 1

When `verify-phase-1` is green:

1. Commit: `chore(phase-1): scaffold + scope + config + sync engine + dev-team`
2. Tag: `v0.1.0-phase-1`
3. Write a short release note in `CHANGELOG.md`
4. Move on to `docs/implementation/phase-2-capability.md` (will be delivered next)

## 8. Reference paths

- Specs: Consolidated Requirements v5.0 in conversation history
- OpenCode docs: https://opencode.ai/docs/
- sqlite-vec docs: https://github.com/asg017/sqlite-vec
- BLAKE3 lib: https://github.com/paulmillr/noble-hashes
