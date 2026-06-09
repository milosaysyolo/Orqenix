# D6F2 baseline (before any FK-2.x changes)

## git status
HEAD detached at opencode/tidy-orchid
nothing to commit, working tree clean

## git rev-parse HEAD
a73ceeba3ef88e9697e05d6de98d9e4d27e439f8

## file existence audit
MISSING: scripts/verify-phase-6.ts (path is scripts/gates/verify-phase-6.ts — alias in spec)
EXISTS: packages/mesh-discovery/vitest.config.ts
EXISTS: packages/mesh-transport-http/src/transport.ts
EXISTS: packages/mesh-transport-http/src/identity.ts
EXISTS: packages/mesh-transport-http/package.json
EXISTS: packages/mesh-transport-libp2p/package.json
EXISTS: apps/local-node/src/cli.ts
EXISTS: apps/local-node/test/cli.test.ts
EXISTS: apps/local-node/test/e2e.integration.test.ts
EXISTS: .github/workflows/native-matrix.yml
EXISTS: scripts/ci/native-matrix/fixtures/blake3-known.json

## verify-phase-6 outcome
ALL GATES PASS (total 95.38s). Repo is READY for tag v0.6.0-phase-6.
