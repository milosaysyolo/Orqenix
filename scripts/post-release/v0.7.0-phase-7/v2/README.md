# Post-Release Validation v2 — Hardened

## Run

```bash
# Local Linux / WSL2 / macOS
node scripts/post-release/v0.7.0-phase-7/v2/run-all.mjs --strict

# CI (preferred — closes Linux-only items)
gh workflow run post-release-validation-v2.yml --ref v0.7.0-phase-7 -f strict=true

# Pro deps fix (run first if item 7 FAILs)
node scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs --dry-run
node scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs
```

## Verdict states
| State | Meaning | Action |
|---|---|---|
| GO | All P0 PASS with strong evidence | Announce release |
| INCONCLUSIVE | At least one P0 SKIP or weak evidence | Run on Linux CI |
| NO-GO | At least one P0 FAIL | Fix + re-run |

## Evidence-strength gating
Every PASS must satisfy:
- Script exit code 0
- stdout.log size > 0
- All expected keywords from item declaration appear in stdout.log
- Without keyword match, PASS is auto-downgraded to FAIL.

## Items
| # | Item | Severity | Linux-only |
|---|---|---|---|
| 1 | Re-render D7.4 report | P1 | No |
| 2 | Measure real benchmarks | P0 | No |
| 3 | Fresh-clone smoke (real npm install) | P0 | No |
| 4 | Miniflare conformance (real bindings) | P0 | Yes |
| 5 | OTLP gRPC interop (real docker collector) | P0 | Yes |
| 6 | Provenance + cosign + tags (real npm view + cosign verify) | P0 | No |
| 7 | Pro deps audit (BOM + workspace:* + file:) | P1 | No |

## Exit codes
- `0` — GO
- `1` — NO-GO
- `2` — INCONCLUSIVE
