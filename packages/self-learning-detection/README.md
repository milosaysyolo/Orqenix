# @orqenix/self-learning-detection

> Apache-2.0 basic instinct detection for Orqenix.
> Phase 8 (D8.γ). Charter gate G67 (Observer + Detection, 14 sub-criteria).

## Mission

Scans observation events to detect recurring workflow patterns worth promoting
to reusable skills. This is the BASIC (OSS) detection. Advanced algorithms
(semantic clustering, A/B comparison, time-savings) ship in
`@orqenix-pro/self-learning-advanced` (Pro).

## Algorithms (basic OSS)

| Algorithm           | Description                                  |
| ------------------- | -------------------------------------------- |
| Sequence detection  | Identifies recurring N-action sequences      |
| Frequency threshold | Minimum 5 occurrences (configurable)         |
| Outcome correlation | Filters by success rate (≥80%, configurable) |

## Promotion thresholds (configurable per CR v8.0)

- `min_occurrences`: 5
- `min_success_rate`: 0.80
- `cooldown_hours`: 24 (avoid re-surfacing same pattern)

## Impact score

```
impact_score = frequency × success_rate × estimated_time_saved
```

Candidates are ranked by impact score in the Promoter UI.

## Output

`instinct_candidates` table rows (status='detected') ready for human review.

## License

Apache-2.0 , see ./LICENSE
