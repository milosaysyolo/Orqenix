# Release Notes — v0.5.0-phase-5

**Release date**: 2026-06-03
**Code name**: Memory Foundation Refactor
**Phase**: 5 of N

## What's in this release

Phase 5 ships the local-first memory mesh foundation for Orqenix. Every Phase 5
package targets the OSS tier and follows the contract-snapshot discipline from
CR v7.1: every cross-package surface is gated by at least one charter gate, and
the Phase 4 plugin contract is preserved verbatim.

## Highlights

- **Memory Matrix** — 4-tier memory model with content-hash idempotency and
  shared distillation watermark
- **Cross-scope mesh** — capability tokens, scope links, workspace membership,
  parallel mesh query with quorum
- **Compression v2** — Smart Compression Engine with Tier-0 preservation and
  105% overflow cap from CR v7.1
- **Tamper-evident audit log** — BLAKE3-chained, 16 lifecycle event kinds
- **Safe detach** — 2-step planner / executor with random-salt confirmation token
- **Migration tooling** — automatic rollback on failure, BLAKE3-verified backup
- **CLI surface** — `orqenix` command for scope, link, workspace, audit, detach,
  migrate

## Upgrading from Phase 4

Run `orqenix migrate status` to confirm the current phase, then `orqenix migrate up`
to apply Phase 5 migrations. The Phase 4 default plugin contract is preserved
verbatim, so any Phase 4 caller of `@orqenix/plugin-compress-context` continues
to work unchanged.

## What's not in this release

- Pro tier (polyglot backends, LLM-based distillation, mesh delegation,
  blast-radius) ships in the separate Orqenix-Pro repo
- HTTP and libp2p mesh transports are deferred to Phase 6
- Cloud tier (`@orqenix-cloud/*`) is deferred to Phase 7

## Cumulative project status

| Metric         | Value          |
| -------------- | -------------- |
| Phases shipped | 1 through 5    |
| Current tag    | v0.5.0-phase-5 |
| License        | Apache 2.0     |
| Charter Gates  | 31             |
| Test count     | ~446           |
| LOC            | ~25,220        |

## Acceptance recipe

```bash
git clone <repo>
cd Orqenix
pnpm install
pnpm tsx scripts/gates/run-all.ts
pnpm tsx scripts/gates/phase-5-final-integration.ts
```

Expected outcome: all 31 charter gates PASS, integration smoke 6 stages PASS.

## Thanks

Phase 5 was designed and shipped by Milo Nguyen (Orqenix). CR v7.1 specification
locked on 2026-06-01.
