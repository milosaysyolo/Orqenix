# v2 Hardening — Post-Release Validation

## What changed vs v1

| Area             | v1                  | v2                                          |
| ---------------- | ------------------- | ------------------------------------------- |
| Verdict states   | GO / NO-GO          | GO / INCONCLUSIVE / NO-GO                   |
| P0 SKIP behavior | Counted as not-FAIL | Auto-downgrade to INCONCLUSIVE              |
| PASS criteria    | exit code 0         | exit code 0 + evidence keyword match        |
| Platform         | Bash only           | Bash + Node orchestrator + Linux CI primary |
| Item 3           | Local build         | Real npm install from registry              |
| Item 5           | Local unit test     | Real docker otel-collector interop          |
| Item 6           | Directory check     | npm view + cosign + git ls-remote           |
| Pro deps fix     | Manual              | Automated fix-pro-deps.mjs                  |
| Windows host     | Pretends to run     | Force-skip P0 items, mark INCONCLUSIVE      |

## Required to declare GO

- Run on Linux (CI ubuntu-latest or WSL2)
- 5 P0 items must PASS with evidence keyword match
- Pro deps fix applied + Pro packages republished
- Tag v0.7.0-phase-7 pushed to all 3 repos before item 6
