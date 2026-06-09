# FK-1.4 Audit: libp2p peerDeps + G40 p95 bench

**Date:** 2026-06-09

## Phase 1: Pre-flight raw output
- mesh-transport-libp2p package.json: has dependencies for @libp2p/interface ^2.0.0, libp2p ^2.0.0, etc. No peerDependencies block present.
- pnpm overrides at root: protobufjs, tmp. No @libp2p/interface override.
- Bench file exists: packages/transport-security/test/bench.p95.test.ts
- p95 measured: 0.402ms (well under 10ms target)

## Phase 2: Decisions
- peerDependencies: **added** (was missing)
- Bench file: **exists** (no restoration needed)
- p95 measured: **0.402ms** (under 10ms target)

## Phase 3: Changes applied
- packages/mesh-transport-libp2p/package.json: +peerDependencies block for @libp2p/interface ^2.0.0
- packages/transport-security/test/bench.p95.test.ts: unchanged (exists and passes)

## Phase 4: Verification
- 4.1 build: PASS (0 TS errors)
- 4.2 peerDependencies declared: "@libp2p/interface": "^2.0.0" with optional: false
- 4.3 bench rerun: p50=0.247ms p95=0.402ms p99=1.063ms n=100000 — all under 10ms
- 4.4 no regression: libp2p 47/47 PASS, transport-security 49/49 PASS
- 4.5 full verify: ALL GATES PASS (94.23s)

## Outstanding
- none
