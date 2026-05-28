# Integration Tests

Cross-repo end-to-end tests for Orqenix and Orqenix-Pro.

## Prereqs
- Orqenix and Orqenix-Pro must be sibling directories
- Both repos built: `pnpm build` in each
- Orqenix-Pro keys generated: `pnpm generate-test-keys` in `../Orqenix-Pro`

## Run
```bash
pnpm install
pnpm test
```

## Test suites

* 01 init-and-doctor: scaffolding, doctor health
* 02 pro-license-install: signed license install
* 03 feature-gating: hasFeature semantics
* 04 grace-transition: active to grace to expired
* 05 marketplace-install: team install, sync, validate
* 06 knowledge-layer-flow: kb-docs + kb-code + kb-decisions
* 07 snapshot-restore: create + verify + tamper-detect
* 08 tag-sync: cross-repo tag and version sync

Total: 30 behavior tests.
