# @orqenix/instinct-promoter

> Apache-2.0 instinct promoter for Orqenix. Human-in-the-loop candidate review.
> Phase 8 (D8.γ). Charter gate G67 (Observer + Detection, 14 sub-criteria).

## Mission

Surfaces detected instinct candidates for human review. Per CR v8.0 Section 9.4.3,
the user reviews each candidate ranked by impact score and chooses:

| Action                        | Effect                                                   |
| ----------------------------- | -------------------------------------------------------- |
| **Promote**                   | Generate a skill from the candidate (via skill-genesis)  |
| **Promote (Customize First)** | Open skill builder pre-filled, user edits before save    |
| **Reject**                    | Mark rejected; never re-surface this pattern hash        |
| **Defer**                     | Hide for now; re-surface if more observations accumulate |

## Privacy: redacted observation samples

The Promoter shows sample observations that formed each candidate, but PII is
already redacted at capture time (observer). Sample IDs reference redacted events.

## Layered exports

- `@orqenix/instinct-promoter` , core PromoterService (headless, server-side)
- `@orqenix/instinct-promoter/ui` , React components (CandidateCard, CandidateList)

## License

Apache-2.0 , see ./LICENSE
