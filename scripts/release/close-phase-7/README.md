# Phase 7 Master Closure \u2014 release v0.7.0 (clean semver)

Drives Phase 7 to FULLY CLOSED. Clean semver everywhere: 0.7.0 / ^0.7.0 / v0.7.0.
NO -phase-7 suffix in npm version, dep range, or git tag.

## Local (blocks 0, 1, 2, 5, 7)

```bash
node scripts/release/close-phase-7/close-phase-7-master.mjs --plan
node scripts/release/close-phase-7/close-phase-7-master.mjs --block 0              # revert + scrub -phase-7
node scripts/release/close-phase-7/close-phase-7-master.mjs --from 1 --to 2 --strict
```

## CI (blocks 6sec security, 3 ceremony, 4 validation)

```bash
gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA
```

## Closure gate (Definition of Done)

ALL blocks GREEN:

| Block | Name                | Gate                                                        |
| ----- | ------------------- | ----------------------------------------------------------- |
| 0     | Revert bad -phase-7 | .bak restored, no -phase-7 ranges anywhere                  |
| 1     | Fix code drift      | bench files real, D7.4 clean                                |
| 2     | Fix Pro deps        | Pro deps -> ^0.7.0, build/test OK (after publish)           |
| 6sec  | Security            | 5 security tests + no DHT/P2P (Cloud repo CI)               |
| 3     | Release ceremony    | published 0.7.0 + signed + tagged v0.7.0 (3 repos same day) |
| 4     | v2 validation       | verdict GO on Linux                                         |
| 5     | Defer limitations   | deferred issues filed (milestone v0.7.1)                    |
| 7     | Docs + announce     | docs measured + memory checkpoint                           |

## Safety

Block 0 first \u2014 scrubs the earlier wrong -phase-7 ranges.
Block 3 irreversible (npm MFA). Requires --confirm I-UNDERSTAND-MFA + Linux/OIDC.
Multiple guards assert no -phase-7 leaks before publish.
