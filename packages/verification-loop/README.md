# @orqenix/verification-loop

> Apache-2.0 verification loop for Orqenix.
> Phase 8 (D8.γ). Charter gate G68 (Skill Genesis + Verification, 12 sub-criteria).

## Mission

Before a generated skill becomes default-enabled, it MUST pass verification
(Anti-38). Per CR v8.0 Section 9.4.5:

| Check            | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| Replay test      | Re-run skill against historical observation samples; compare outcome |
| Cross-validation | Test on observations NOT used to generate the skill (20% holdout)    |
| A/B comparison   | (Pro) compare skill output vs manual outcomes                        |

## Status progression

```
unverified → replay_tested → verified → marketplace-ready
```

- `unverified`: just generated (skill-genesis default)
- `replay_tested`: passed replay against generating samples
- `verified`: passed cross-validation on holdout
- `marketplace-ready`: verified + user opted to publish

Only `verified`+ skills can be default-enabled (Anti-38).

## Thresholds (configurable)

- `replay_test_samples_min`: 5
- `cross_validation_holdout_pct`: 20
- `success_threshold_pct`: 80

## License

Apache-2.0 , see ./LICENSE
