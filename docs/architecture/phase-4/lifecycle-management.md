# Lifecycle Management

> Status: Phase 4 design, locked.
> Cross-reference: CR v6.2 Chapter 11 (Versioning), Chapter 12 (Garbage Collection).
> Owner: Milo, orqenix.

## 1. Goals

Lifecycle Management is the production-grade subsystem that gives Orqenix:

- Predictable versioning across three independent tiers
- Atomic snapshot and rollback of any workspace state
- Bounded disk usage via a 4-state garbage collection lifecycle
- Retention policy that respects user data while reclaiming dead artifacts
- Audit trail of every lifecycle transition

Without this layer, Orqenix collapses into another agent framework where users
cannot trust the system to evolve, recover, or stay lean over time.

## 2. Three-tier versioning

Orqenix versions three independent things. Conflating them is the most common
failure mode in agent frameworks, so each tier has its own format, storage,
and resolution rule.

### 2.1 Skill version

- Format: strict semver MAJOR.MINOR.PATCH
- Stored in `skill.json` and the YAML frontmatter of `SKILL.md`
- Conflict detection runs on every `orqenix sync` and every marketplace install
- A skill's enforcement level (must, should, may) is independent of its version

The resolver refuses to install a skill whose declared version conflicts with
an already installed skill in the same workspace, unless the user explicitly
runs `orqenix skill upgrade <name>`.

### 2.2 Marketplace source version

Three forms, all defined in `marketplace.json`:

- Form A in-tree: version derived from the source repo's `package.json`
- Form B external URL: SHA pinned, immutable after pin
- Form B git-subdir: ref plus SHA, both stored

The CLI never trusts a tag or branch alone; SHA is the source of truth.

### 2.3 Lockfile pin

- File: `orqenix.lock` at workspace root
- Records every installed skill at the exact SHA at install time
- The resolver refuses to operate if the lockfile drifts from `marketplace.json`
- Lockfile is committed to git, just like `package-lock.json` or `pnpm-lock.yaml`

The interplay: skill version answers "what API contract", source version
answers "where did the bytes come from", lockfile pin answers "are we still
running the bytes we installed".

## 3. Snapshot mechanics

A snapshot is an atomic copy of the workspace state, captured by content hash
and stored under `.orqenix/snapshots/<timestamp>-<id>/`.

### 3.1 What is captured

- All installed skills (resolved bytes, not just declarations)
- The lockfile
- DocsKB and DecisionKB sqlite files
- CodeKB index
- Touched-files ledger
- Audit log up to the snapshot point

### 3.2 What is not captured

- User source code that Orqenix did not touch
- Secrets and environment variables
- Embedding provider API keys

The boundary is deliberate. Snapshots restore Orqenix state, not the entire
project. This keeps snapshot size bounded and avoids accidental leaks of
secrets when sharing a snapshot for debugging.

### 3.3 Snapshot CLI

- `orqenix snapshot create [--name <label>]`
- `orqenix snapshot list`
- `orqenix snapshot show <id>`
- `orqenix snapshot restore <id> [--dry-run]`
- `orqenix snapshot diff <id-a> <id-b>`
- `orqenix snapshot delete <id>`

`restore` is always two-phase: it shows a diff, prompts for confirmation,
then applies. With `--dry-run`, it never writes.

## 4. Rollback semantics

Rollback is a deliberate, user-initiated operation, never automatic. The
system warns if the snapshot to restore predates a schema migration that
cannot be undone.

### 4.1 Pre-rollback checks

- Verify snapshot integrity by content hash
- Check for schema version mismatch
- Refuse if working tree has uncommitted changes touched by Orqenix
- Print full diff before applying

### 4.2 Post-rollback state

- A new snapshot of the pre-rollback state is created automatically
- The audit log records the rollback as a discrete event
- The lockfile is restored exactly to the captured pin
- Knowledge base files are restored from the snapshot copies

## 5. Garbage collection, 4-state lifecycle

Every Orqenix-managed artifact lives in one of four states. Transitions are
explicit, and the GC scanner promotes artifacts through the states based on
the retention policy.

### 5.1 States

- `active`: in use by at least one skill, agent, or workspace pin
- `idle`: not referenced for the idle window, eligible for promotion
- `deprecated`: marked for deletion, no longer eligible for use
- `deleted`: bytes removed, only the metadata remains in the audit log

### 5.2 Promotion rules

- `active` to `idle` after `retention.idleAfterDays` of no reference
- `idle` to `deprecated` after `retention.deprecateAfterDays` of being idle
- `deprecated` to `deleted` after `retention.deleteAfterDays` and zero references

Promotion runs once per `orqenix gc` invocation. The CLI exposes `--dry-run`
that prints the plan without applying.

### 5.3 Demotion

Any read of an artifact resets its idle clock and demotes it back to `active`.
This is critical: it prevents the GC from deleting something a user just
loaded but did not yet wire into a skill.

## 6. Retention policy

Defined in `orqenix.config.json` under `lifecycle.retention`:

- `idleAfterDays`: default 30
- `deprecateAfterDays`: default 60
- `deleteAfterDays`: default 90
- `snapshotMaxCount`: default 20
- `snapshotMaxBytes`: default 2 GB

The defaults bound long-term disk usage to a predictable budget while giving
users a generous window to recover work.

## 7. Disk budget enforcement

When `snapshotMaxBytes` is exceeded, the oldest snapshots are deleted first,
but never the most recent 3. This protects the user from accidental
catastrophic loss if a bad snapshot replaces a good one.

Bytes are computed from the on-disk size of the snapshot directory, not the
sum of declared skill sizes. This catches bloat from large CodeKB indices and
embedding caches.

## 8. Audit log

Every lifecycle event writes one append-only line to
`.orqenix/audit/lifecycle.jsonl`:

- timestamp
- actor (user, GC scanner, restore operation)
- artifact id and kind
- transition from-state to-state
- reason

The audit log is signed with an HMAC keyed by a workspace-local secret
generated at first run. Tamper detection runs as part of `orqenix doctor`.

## 9. Recovery from corrupted snapshot

If `orqenix snapshot restore` detects a hash mismatch, it aborts and prints
the affected files. Two recovery paths:

- Attempt restore from a sibling snapshot
- Open an issue with the audit log and the corrupted snapshot id

The system never silently restores partial data. Better to fail loudly than
to leave the user with a half-restored workspace.

## 10. Migration from v6.1 lifecycle model

v6.1 used a single-tier version field on skills and no formal snapshot
concept. The migration runs once when Orqenix detects an older workspace:

- Read existing `skill.json` files, infer source version from the install path
- Generate an initial lockfile from the existing installation
- Create a baseline snapshot tagged `v6.1-baseline`
- Write a migration record to the audit log

Users keep their data; the new lifecycle layer simply gains visibility.

## 11. Performance considerations

- Snapshot creation runs in O(size of changed files) using hardlinks on
  filesystems that support them
- GC scan is incremental: it records the last scan timestamp and only
  considers artifacts modified since then
- Audit log writes are batched per CLI invocation

Benchmark targets, enforced in CI via `pnpm bench:phase-4`:

- `orqenix snapshot create` p95 under 1500 ms for a 100 MB workspace
- `orqenix gc --dry-run` p95 under 500 ms

## 12. Security implications

- Snapshots are stored unencrypted on disk; users on shared machines should
  rely on filesystem-level encryption
- Audit log HMAC key is per workspace, not per user; this is acceptable for
  the current threat model but will be revisited in Phase 5

## 13. Future work

- Remote snapshot storage to S3-compatible backends (Phase 6)
- Cross-workspace snapshot diff (Phase 6)
- Time-travel debugging UI in `@orqenix-cloud` (Cloud tier)
