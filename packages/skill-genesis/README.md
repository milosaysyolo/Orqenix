# @orqenix/skill-genesis

> Apache-2.0 skill genesis for Orqenix. Synthesize CSF + code from candidates.
> Phase 8 (D8.γ). Charter gate G68 (Skill Genesis + Verification, 12 sub-criteria).

## Mission

When a user promotes an instinct candidate, this package synthesizes a full
CSF skill from the observed pattern. Per CR v8.0 Section 9.4.4:

1. Analyze candidate's observation samples to extract parameters
2. Auto-infer the input schema from variations
3. Synthesize executable code stub (TypeScript / Python / shell)
4. Generate test fixtures from observation samples
5. Tag provenance: `derived_from_observations`

## Output

A `CanonicalSkillFormat` with:

- `kind: 'skill'`
- `provenance.derived_from_observations: [event_id, ...]`
- `provenance.verification_status: 'unverified'` (Anti-38: must verify first)
- Synthesized `implementation.source` + `implementation.examples`

## Language synthesis

| Language     | When chosen                                |
| ------------ | ------------------------------------------ |
| `shell`      | Pattern dominated by shell_command actions |
| `python`     | Pattern includes Python-specific actions   |
| `typescript` | Default for general workflows              |

## License

Apache-2.0 , see ./LICENSE
