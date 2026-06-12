# Phase 7 Master Closure

Drives Phase 7 to FULLY CLOSED state. 7 blocks, sequential, fail-fast, checkpointed.
Applies Phase 5/6 npm/tag/versioning lessons.

## Local (blocks 1, 2, 6sec, 5, 7)

```bash
node scripts/release/close-phase-7/close-phase-7-master.mjs --plan              # preview
node scripts/release/close-phase-7/close-phase-7-master.mjs --from 1 --to 2 --strict
node scripts/release/close-phase-7/close-phase-7-master.mjs --block 6 --strict  # security
```

## CI (blocks 3 ceremony + 4 validation \u2014 require OIDC + tokens)

```bash
gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA
```

## Closure gate (Definition of Done)

Phase 7 is CLOSED only when ALL blocks are GREEN:

| Block | Name | Gate |
|-------|------|------|
| 1 | Fix code drift | bench files real, D7.4 clean |
| 2 | Fix Pro deps | Pro deps fixed, build/test OK |
| 6sec | Security pre-flight | 7 security checks pass |
| 3 | Release ceremony | published + signed + tagged (3 repos) |
| 4 | v2 validation | verdict GO on Linux |
| 5 | Defer limitations | deferred issues filed (milestone v0.7.1) |
| 7 | Docs + announce | docs measured + memory checkpoint |

## State

Progress persisted to out/close-phase-7/closure-state.json. Re-runs resume from
recorded state. Each block writes a checkpoint.

## Safety

Block 3 is IRREVERSIBLE (npm MFA blocks unpublish). Requires --confirm
I-UNDERSTAND-MFA and Linux+OIDC. Local Windows runs will BLOCK it.

Security pre-flight (block 6sec) runs BEFORE publish so unsafe code never ships.
